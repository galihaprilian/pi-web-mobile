import {
  createAssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@mariozechner/pi-ai";

export interface OAuthProviderStatus {
  id: string;
  name: string;
  loggedIn: boolean;
}

export interface OAuthPromptPayload {
  message: string;
  placeholder?: string;
  allowEmpty?: boolean;
  kind?: "prompt" | "manual-code";
}

export interface OAuthSessionState {
  id: string;
  providerId: string;
  providerName: string;
  status: "idle" | "running" | "pending_auth" | "waiting_input" | "completed" | "error";
  authInfo?: {
    url: string;
    instructions?: string;
  };
  prompt?: OAuthPromptPayload;
  messages: string[];
  error?: string;
}

export interface ProjectDirectoryEntry {
  name: string;
  path: string;
}

export interface ProjectDirectoryResponse {
  path: string;
  displayPath: string;
  parentPath: string | null;
  entries: ProjectDirectoryEntry[];
}

export interface StartupContext {
  startupId: string;
  defaultProjectPath: string;
  requireProjectSelection: boolean;
  launchMode: string;
  sourceCwd: string;
}

export interface PiSessionListItem {
  path: string;
  id: string;
  title: string;
  preview: string;
  cwd: string;
  projectPath: string;
  messageCount: number;
  lastModified: string;
}

export interface PiSessionData {
  path: string;
  title: string;
  projectPath: string;
  thinkingLevel: string;
  messages: any[];
  model?: any;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.error || response.statusText || "Request failed";
    throw new Error(message);
  }

  return data as T;
}

export async function listOAuthProviders(): Promise<OAuthProviderStatus[]> {
  return request<OAuthProviderStatus[]>("/api/oauth/providers");
}

export async function startOAuthLogin(providerId: string): Promise<{ sessionId: string }> {
  return request<{ sessionId: string }>("/api/oauth/start", {
    method: "POST",
    body: JSON.stringify({ providerId }),
  });
}

export async function getOAuthSession(sessionId: string): Promise<OAuthSessionState> {
  return request<OAuthSessionState>(`/api/oauth/session/${encodeURIComponent(sessionId)}`);
}

export async function submitOAuthSessionInput(sessionId: string, value: string): Promise<void> {
  await request(`/api/oauth/session/${encodeURIComponent(sessionId)}/input`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}

export async function logoutOAuthProvider(providerId: string): Promise<void> {
  await request("/api/oauth/logout", {
    method: "POST",
    body: JSON.stringify({ providerId }),
  });
}

export async function getOAuthApiKey(providerId: string): Promise<string | undefined> {
  const response = await request<{ apiKey?: string }>(
    `/api/oauth/token?provider=${encodeURIComponent(providerId)}`,
  );
  return response.apiKey;
}

export async function getOAuthModels(providerId: string): Promise<any[]> {
  const response = await request<{ models: any[] }>(
    `/api/oauth/models?provider=${encodeURIComponent(providerId)}`,
  );
  return response.models;
}

export async function listProjectDirectories(path = ""): Promise<ProjectDirectoryResponse> {
  return request<ProjectDirectoryResponse>(`/api/projects?path=${encodeURIComponent(path)}`);
}

export async function getStartupContext(): Promise<StartupContext> {
  return request<StartupContext>("/api/startup-context");
}

export async function listPiSessions(projectPath = ""): Promise<PiSessionListItem[]> {
  return request<PiSessionListItem[]>(`/api/pi-sessions?project=${encodeURIComponent(projectPath)}`);
}

export async function loadPiSession(sessionPath: string): Promise<PiSessionData> {
  return request<PiSessionData>(`/api/pi-session?path=${encodeURIComponent(sessionPath)}`);
}

export async function appendPiSession(payload: {
  path: string;
  title: string;
  thinkingLevel: string;
  model?: { provider: string; id: string } | null;
  messages: any[];
}): Promise<void> {
  await request("/api/pi-session/append", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const createFailureMessage = (model: Model<any>, reason: "error" | "aborted", errorMessage: string) => ({
  role: "assistant" as const,
  content: [],
  api: model.api,
  provider: model.provider,
  model: model.id,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: reason,
  errorMessage,
  timestamp: Date.now(),
});

export function createServerStreamFn() {
  return async (model: Model<any>, context: Context, options?: SimpleStreamOptions) => {
    const stream = createAssistantMessageEventStream();

    void (async () => {
      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            context: {
              ...context,
              tools: (context.tools || []).map((tool: any) => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              })),
            },
            options: {
              ...options,
              signal: undefined,
            },
          }),
          signal: options?.signal,
        });

        if (!response.ok || !response.body) {
          const message = await response.text();
          const failure = createFailureMessage(
            model,
            options?.signal?.aborted ? "aborted" : "error",
            message || response.statusText || "Streaming request failed",
          );
          stream.push({ type: "error", reason: failure.stopReason, error: failure });
          stream.end();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";

          for (const chunk of chunks) {
            const line = chunk
              .split("\n")
              .find((entry) => entry.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            stream.push(JSON.parse(payload));
          }
        }

        stream.end();
      } catch (error) {
        const reason = options?.signal?.aborted ? "aborted" : "error";
        const failure = createFailureMessage(
          model,
          reason,
          error instanceof Error ? error.message : String(error),
        );
        stream.push({ type: "error", reason, error: failure });
        stream.end();
      }
    })();

    return stream;
  };
}
