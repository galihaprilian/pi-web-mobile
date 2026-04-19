import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { getModels, streamSimple } from "@mariozechner/pi-ai";
import { getOAuthProvider, getOAuthProviders, type OAuthCredentials, type OAuthPrompt } from "@mariozechner/pi-ai/oauth";
import type { Plugin } from "vite";

type StoredOAuthCredential = { type: "oauth" } & OAuthCredentials;
type AuthFileShape = Record<string, StoredOAuthCredential | { type: "api_key"; key: string }>;

type LoginSessionState = {
  id: string;
  providerId: string;
  providerName: string;
  status: "idle" | "running" | "pending_auth" | "waiting_input" | "completed" | "error";
  authInfo?: {
    url: string;
    instructions?: string;
  };
  prompt?: {
    message: string;
    placeholder?: string;
    allowEmpty?: boolean;
    kind?: "prompt" | "manual-code";
  };
  messages: string[];
  error?: string;
  resolveInput?: (value: string) => void;
  rejectInput?: (error: Error) => void;
};

const AGENT_DIR = path.join(os.homedir(), ".pi", "agent");
const AUTH_FILE_PATH = path.join(AGENT_DIR, "auth.json");
const SESSIONS_ROOT = path.join(AGENT_DIR, "sessions");
const APP_STATE_DIR = path.join(os.homedir(), ".config", "pi-web-mobile");
const STARTUP_STATE_PATH = path.join(APP_STATE_DIR, "runtime-state.json");
const HOME_DIR = os.homedir();
const loginSessions = new Map<string, LoginSessionState>();
let piCodingAgentModulePromise: Promise<any> | undefined;
let piMessagesModulePromise: Promise<any> | undefined;

function ensureAuthDir() {
  fs.mkdirSync(path.dirname(AUTH_FILE_PATH), { recursive: true });
}

function ensureAppStateDir() {
  fs.mkdirSync(APP_STATE_DIR, { recursive: true });
}

function readStartupState() {
  ensureAppStateDir();
  if (!fs.existsSync(STARTUP_STATE_PATH)) {
    const fallback = {
      startupId: `${Date.now()}-fallback`,
      defaultProjectPath: "",
      requireProjectSelection: true,
      launchMode: "service",
      sourceCwd: "",
      runtimeMode: "preview",
      servicePort: 5173,
    };
    fs.writeFileSync(STARTUP_STATE_PATH, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(STARTUP_STATE_PATH, "utf8"));
  } catch {
    return {
      startupId: `${Date.now()}-fallback`,
      defaultProjectPath: "",
      requireProjectSelection: true,
      launchMode: "service",
      sourceCwd: "",
      runtimeMode: "preview",
      servicePort: 5173,
    };
  }
}

function readAuthFile(): AuthFileShape {
  ensureAuthDir();
  if (!fs.existsSync(AUTH_FILE_PATH)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE_PATH, "utf8")) as AuthFileShape;
  } catch {
    return {};
  }
}

function writeAuthFile(data: AuthFileShape) {
  ensureAuthDir();
  fs.writeFileSync(AUTH_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req: any): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function pushMessage(session: LoginSessionState, message: string) {
  session.messages = [...session.messages, message].slice(-30);
}

function sanitizeRelativeProjectPath(input: string | null | undefined): string {
  const candidate = (input || "").trim();
  const resolved = path.resolve(HOME_DIR, candidate || ".");
  const relative = path.relative(HOME_DIR, resolved);
  const escaped = relative.startsWith("..") || path.isAbsolute(relative);

  if (escaped) {
    throw new Error("Project path must stay inside your home directory");
  }

  return relative === "" ? "" : relative.split(path.sep).join("/");
}

function absoluteProjectPath(relativePath: string): string {
  const normalized = sanitizeRelativeProjectPath(relativePath);
  return path.resolve(HOME_DIR, normalized || ".");
}

function displayProjectPath(relativePath: string): string {
  return relativePath ? `~/${relativePath}` : "~";
}

function getPiCodingAgentModulePath(relativeModulePath: string): string {
  const globalRoot = execSync("npm root -g").toString("utf8").trim();
  return path.join(globalRoot, "@mariozechner", "pi-coding-agent", "dist", relativeModulePath);
}

async function loadPiSessionManagerModule() {
  if (!piCodingAgentModulePromise) {
    piCodingAgentModulePromise = import(pathToFileURL(getPiCodingAgentModulePath(path.join("core", "session-manager.js"))).href);
  }
  return piCodingAgentModulePromise;
}

async function loadPiMessagesModule() {
  if (!piMessagesModulePromise) {
    piMessagesModulePromise = import(pathToFileURL(getPiCodingAgentModulePath(path.join("core", "messages.js"))).href);
  }
  return piMessagesModulePromise;
}

function ensureWithinSessionsRoot(targetPath: string): string {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(SESSIONS_ROOT);

  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`) && resolvedTarget !== resolvedRoot) {
    throw new Error("Session path must stay inside ~/.pi/agent/sessions");
  }

  return resolvedTarget;
}

function getSessionProjectPathFromCwd(cwd: string): string {
  const relative = path.relative(HOME_DIR, cwd);
  if (!relative || relative === "") return "";
  if (relative.startsWith("..") || path.isAbsolute(relative)) return "";
  return relative.split(path.sep).join("/");
}

function extractMessageText(message: any): string {
  const { content } = message || {};
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === "text")
      .map((block) => block.text || "")
      .join(" ")
      .trim();
  }
  return "";
}

function buildPiSessionListItem(filePath: string) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return null;

  const entries = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean) as any[];

  const header = entries[0];
  if (!header || header.type !== "session") return null;

  let title = "";
  let preview = "";
  let messageCount = 0;

  for (const entry of entries) {
    if (entry.type === "session_info") {
      title = (entry.name || "").trim() || title;
    }

    if (entry.type === "message") {
      const message = entry.message;
      if (!message) continue;
      if (["user", "assistant", "toolResult"].includes(message.role)) {
        messageCount += 1;
      }
      if (!preview && message.role === "user") {
        preview = extractMessageText(message);
      }
    }
  }

  const stats = fs.statSync(filePath);
  return {
    path: filePath,
    id: header.id,
    title: title || preview || path.basename(filePath),
    preview: preview || "(no messages)",
    cwd: header.cwd || "",
    projectPath: getSessionProjectPathFromCwd(header.cwd || ""),
    messageCount,
    lastModified: stats.mtime.toISOString(),
  };
}

async function resolvePiSessionModel(provider: string, modelId: string) {
  let models = getModels(provider as any);
  const providerImpl = getOAuthProvider(provider);
  const credential = await getStoredOAuthCredential(provider);

  if (providerImpl && credential && providerImpl.modifyModels) {
    models = providerImpl.modifyModels(models, credential) as any;
  }

  return models.find((model) => model.id === modelId);
}

async function getStoredOAuthCredential(providerId: string): Promise<StoredOAuthCredential | undefined> {
  const authData = readAuthFile();
  const credential = authData[providerId];

  if (!credential || credential.type !== "oauth") {
    return undefined;
  }

  if (Date.now() < credential.expires) {
    return credential;
  }

  const provider = getOAuthProvider(providerId);
  if (!provider) {
    return undefined;
  }

  const refreshed = await provider.refreshToken(credential);
  const nextCredential: StoredOAuthCredential = { type: "oauth", ...refreshed };
  authData[providerId] = nextCredential;
  writeAuthFile(authData);
  return nextCredential;
}

function serializeLoginSession(session: LoginSessionState) {
  return {
    id: session.id,
    providerId: session.providerId,
    providerName: session.providerName,
    status: session.status,
    authInfo: session.authInfo,
    prompt: session.prompt,
    messages: session.messages,
    error: session.error,
  };
}

async function startLoginSession(providerId: string): Promise<string> {
  const provider = getOAuthProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown OAuth provider: ${providerId}`);
  }

  const sessionId = randomUUID();
  const session: LoginSessionState = {
    id: sessionId,
    providerId,
    providerName: provider.name,
    status: "running",
    messages: [],
  };
  loginSessions.set(sessionId, session);

  const waitForInput = (prompt: OAuthPrompt, kind: "prompt" | "manual-code" = "prompt") => {
    session.status = "waiting_input";
    session.prompt = { ...prompt, kind };
    return new Promise<string>((resolve, reject) => {
      session.resolveInput = resolve;
      session.rejectInput = reject;
    });
  };

  void provider
    .login({
      onAuth: (info) => {
        session.authInfo = info;
        session.status = "pending_auth";
        pushMessage(session, `Open ${info.url}`);
      },
      onPrompt: async (prompt) => {
        pushMessage(session, prompt.message);
        return await waitForInput(prompt, "prompt");
      },
      onManualCodeInput: async () => {
        return await waitForInput(
          {
            message: "Paste redirect URL or manual code from the login page",
            placeholder: "Paste value here",
            allowEmpty: false,
          },
          "manual-code",
        );
      },
      onProgress: (message) => {
        if (session.status !== "waiting_input" && session.status !== "pending_auth") {
          session.status = "running";
        }
        pushMessage(session, message);
      },
    })
    .then((credentials) => {
      const authData = readAuthFile();
      authData[providerId] = { type: "oauth", ...credentials };
      writeAuthFile(authData);
      session.status = "completed";
      session.prompt = undefined;
      session.resolveInput = undefined;
      session.rejectInput = undefined;
      pushMessage(session, "Login completed");
    })
    .catch((error) => {
      session.status = "error";
      session.error = error instanceof Error ? error.message : String(error);
      session.prompt = undefined;
      session.resolveInput = undefined;
      session.rejectInput = undefined;
      pushMessage(session, session.error);
    });

  return sessionId;
}

async function apiHandler(req: any, res: any, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  const method = (req.method || "GET").toUpperCase();

  try {
    if (url.pathname === "/api/startup-context" && method === "GET") {
      json(res, 200, readStartupState());
      return;
    }

    if (url.pathname === "/api/chat/stream" && method === "POST") {
      const body = await readBody(req);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const abortController = new AbortController();
      req.on("close", () => abortController.abort());

      const responseStream = await streamSimple(body.model, body.context, {
        ...(body.options || {}),
        signal: abortController.signal,
      });

      try {
        for await (const event of responseStream) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (error) {
        const failure = {
          type: "error",
          reason: abortController.signal.aborted ? "aborted" : "error",
          error: {
            role: "assistant",
            content: [],
            api: body.model.api,
            provider: body.model.provider,
            model: body.model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: abortController.signal.aborted ? "aborted" : "error",
            errorMessage: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          },
        };
        res.write(`data: ${JSON.stringify(failure)}\n\n`);
      } finally {
        res.end();
      }
      return;
    }

    if (url.pathname === "/api/oauth/providers" && method === "GET") {
      const authData = readAuthFile();
      const providers = getOAuthProviders().map((provider) => ({
        id: provider.id,
        name: provider.name,
        loggedIn: authData[provider.id]?.type === "oauth",
      }));
      json(res, 200, providers);
      return;
    }

    if (url.pathname === "/api/oauth/start" && method === "POST") {
      const body = await readBody(req);
      const sessionId = await startLoginSession(body.providerId);
      json(res, 200, { sessionId });
      return;
    }

    if (url.pathname.startsWith("/api/oauth/session/") && method === "GET") {
      const sessionId = decodeURIComponent(url.pathname.split("/").pop() || "");
      const session = loginSessions.get(sessionId);
      if (!session) {
        json(res, 404, { error: "Login session not found" });
        return;
      }
      json(res, 200, serializeLoginSession(session));
      return;
    }

    if (url.pathname.startsWith("/api/oauth/session/") && url.pathname.endsWith("/input") && method === "POST") {
      const segments = url.pathname.split("/");
      const sessionId = decodeURIComponent(segments[segments.length - 2] || "");
      const session = loginSessions.get(sessionId);
      if (!session || !session.resolveInput) {
        json(res, 404, { error: "Login prompt not waiting for input" });
        return;
      }

      const body = await readBody(req);
      session.status = "running";
      session.prompt = undefined;
      const resolver = session.resolveInput;
      session.resolveInput = undefined;
      session.rejectInput = undefined;
      resolver(String(body.value ?? ""));
      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/oauth/logout" && method === "POST") {
      const body = await readBody(req);
      const providerId = String(body.providerId || "");
      const authData = readAuthFile();
      delete authData[providerId];
      writeAuthFile(authData);
      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/oauth/token" && method === "GET") {
      const providerId = url.searchParams.get("provider") || "";
      const provider = getOAuthProvider(providerId);
      const credential = await getStoredOAuthCredential(providerId);

      if (!provider || !credential) {
        json(res, 200, { apiKey: undefined });
        return;
      }

      json(res, 200, { apiKey: provider.getApiKey(credential) });
      return;
    }

    if (url.pathname === "/api/oauth/models" && method === "GET") {
      const providerId = url.searchParams.get("provider") || "";
      const provider = getOAuthProvider(providerId);
      const credential = await getStoredOAuthCredential(providerId);
      let models = getModels(providerId as any);

      if (provider && credential && provider.modifyModels) {
        models = provider.modifyModels(models, credential) as any;
      }

      json(res, 200, { models });
      return;
    }

    if (url.pathname === "/api/pi-sessions" && method === "GET") {
      const { getDefaultSessionDir } = await loadPiSessionManagerModule();
      const projectPath = sanitizeRelativeProjectPath(url.searchParams.get("project"));
      const cwd = absoluteProjectPath(projectPath);
      const sessionDir = ensureWithinSessionsRoot(getDefaultSessionDir(cwd, AGENT_DIR));

      const items = !fs.existsSync(sessionDir)
        ? []
        : fs
            .readdirSync(sessionDir)
            .filter((fileName) => fileName.endsWith(".jsonl"))
            .map((fileName) => buildPiSessionListItem(path.join(sessionDir, fileName)))
            .filter(Boolean)
            .sort((a: any, b: any) => {
              return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
            });

      json(res, 200, items);
      return;
    }

    if (url.pathname === "/api/pi-session" && method === "GET") {
      const { loadEntriesFromFile, buildSessionContext } = await loadPiSessionManagerModule();
      const { convertToLlm } = await loadPiMessagesModule();
      const sessionPath = ensureWithinSessionsRoot(decodeURIComponent(url.searchParams.get("path") || ""));
      const listItem = buildPiSessionListItem(sessionPath);

      if (!listItem) {
        json(res, 404, { error: "Session not found" });
        return;
      }

      const entries = loadEntriesFromFile(sessionPath);
      const context = buildSessionContext(entries);
      const resolvedMessages = convertToLlm(context.messages);
      const resolvedModel = context.model
        ? await resolvePiSessionModel(context.model.provider, context.model.modelId)
        : undefined;

      json(res, 200, {
        path: sessionPath,
        title: listItem.title,
        projectPath: listItem.projectPath,
        thinkingLevel: context.thinkingLevel,
        messages: resolvedMessages,
        model: resolvedModel,
      });
      return;
    }

    if (url.pathname === "/api/pi-session/append" && method === "POST") {
      const { SessionManager } = await loadPiSessionManagerModule();
      const body = await readBody(req);
      const sessionPath = ensureWithinSessionsRoot(String(body.path || ""));
      const sessionDir = path.dirname(sessionPath);
      const manager = SessionManager.open(sessionPath, sessionDir);

      const nextTitle = String(body.title || "").trim();
      const currentTitle = manager.getSessionName() || "";
      if (nextTitle !== currentTitle) {
        manager.appendSessionInfo(nextTitle);
      }

      const nextThinkingLevel = String(body.thinkingLevel || "off");
      const currentThinkingLevel = manager.buildSessionContext().thinkingLevel || "off";
      if (nextThinkingLevel !== currentThinkingLevel) {
        manager.appendThinkingLevelChange(nextThinkingLevel);
      }

      const nextModel = body.model;
      const currentModel = manager.buildSessionContext().model;
      if (
        nextModel?.provider &&
        nextModel?.id &&
        (!currentModel ||
          currentModel.provider !== nextModel.provider ||
          currentModel.modelId !== nextModel.id)
      ) {
        manager.appendModelChange(nextModel.provider, nextModel.id);
      }

      for (const message of Array.isArray(body.messages) ? body.messages : []) {
        if (["user", "assistant", "toolResult"].includes(message?.role)) {
          manager.appendMessage(message);
        }
      }

      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/projects" && method === "GET") {
      const relativePath = sanitizeRelativeProjectPath(url.searchParams.get("path"));
      const absolutePath = absoluteProjectPath(relativePath);
      const entries = fs
        .readdirSync(absolutePath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => ({
          name: entry.name,
          path: sanitizeRelativeProjectPath(path.posix.join(relativePath, entry.name)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const parentPath = relativePath ? sanitizeRelativeProjectPath(path.posix.dirname(relativePath)) : null;
      json(res, 200, {
        path: relativePath,
        displayPath: displayProjectPath(relativePath),
        parentPath: parentPath === "." ? "" : parentPath,
        entries,
      });
      return;
    }
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
    return;
  }

  next();
}

export function localApiPlugin(): Plugin {
  return {
    name: "piweb-local-api",
    configureServer(server) {
      server.middlewares.use(apiHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiHandler);
    },
  };
}
