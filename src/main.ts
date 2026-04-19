import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { icon } from "@mariozechner/mini-lit";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import { Agent, type AgentEvent, type AgentMessage } from "@mariozechner/pi-agent-core";
import { getModel, getModels, getProviders, modelsAreEqual, type Model } from "@mariozechner/pi-ai";
import {
  type AgentState,
  ApiKeyPromptDialog,
  AppStorage,
  AssistantMessage,
  createJavaScriptReplTool,
  CustomProvidersStore,
  IndexedDBStorageBackend,
  formatUsage,
  MessageEditor,
  MessageList,
  UserMessage,
  ProviderKeysStore,
  ProvidersModelsTab,
  ProxyTab,
  SessionsStore,
  SettingsDialog,
  SettingsStore,
  SettingsTab,
  StreamingMessageContainer,
  type UserMessageWithAttachments,
  setAppStorage,
} from "@mariozechner/pi-web-ui";
import { html, render } from "lit";
import { Bell, Check, ChevronLeft, Folder, History, Plus, Search, Settings, X } from "lucide";
import "./app.css";
import "./thinking-block-patch";
import {
  createSystemNotification,
  customConvertToLlm,
  registerCustomMessageRenderers,
} from "./custom-messages";
import {
  appendPiSession,
  createServerStreamFn,
  getOAuthApiKey,
  getOAuthModels,
  getStartupContext,
  listOAuthProviders,
  listPiSessions,
  listProjectDirectories,
  loadPiSession,
  type OAuthProviderStatus,
  type PiSessionListItem,
  type ProjectDirectoryResponse,
} from "./local-api";
import { SubscriptionAuthTab } from "./subscription-tab";

registerCustomMessageRenderers();

const settings = new SettingsStore();
const providerKeys = new ProviderKeysStore();
const sessions = new SessionsStore();
const customProviders = new CustomProvidersStore();

const configs = [
  settings.getConfig(),
  SessionsStore.getMetadataConfig(),
  providerKeys.getConfig(),
  customProviders.getConfig(),
  sessions.getConfig(),
];

const backend = new IndexedDBStorageBackend({
  dbName: "pi-web-mobile",
  version: 2,
  stores: configs,
});

settings.setBackend(backend);
providerKeys.setBackend(backend);
customProviders.setBackend(backend);
sessions.setBackend(backend);

const storage = new AppStorage(settings, providerKeys, sessions, customProviders, backend);
setAppStorage(storage);

const FALLBACK_MODEL = getModel("anthropic", "claude-sonnet-4-5-20250929");
const AUTO_DISCOVERY_PROVIDER_TYPES = new Set(["ollama", "llama.cpp", "vllm", "lmstudio"]);
const OAUTH_MARKER = "__oauth__";

type StoredCustomProvider = {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey?: string;
  models?: Model<any>[];
};

type ModelEntry = {
  provider: string;
  model: Model<any>;
  source: "built-in" | "custom";
};

type HistorySessionItem = {
  source: "browser" | "pi";
  id: string;
  title: string;
  preview: string;
  lastModified: string;
  projectPath: string;
  path?: string;
};

let currentSessionId: string | undefined;
let currentPiSessionPath: string | undefined;
let currentPiSyncedMessageCount = 0;
let currentTitle = "";
let isEditingTitle = false;
let isHistorySheetOpen = false;
let historySheetLoading = false;
let historySheetError = "";
let historySessions: HistorySessionItem[] = [];
let isSyncingPiSession = false;
let isModelSheetOpen = false;
let modelSheetLoading = false;
let modelSheetSearch = "";
let modelSheetError = "";
let availableModelEntries: ModelEntry[] = [];
let oauthProviders: OAuthProviderStatus[] = [];
let selectedProjectPath = "";
let isProjectSheetOpen = false;
let projectSheetLoading = false;
let projectSheetError = "";
let projectDirectory: ProjectDirectoryResponse | null = null;
let startupContextId = "";
let startupLaunchMode = "unknown";
let startupRuntimeMode = "unknown";
let startupSourceCwd = "";
let startupDefaultProjectPath = "";
let startupServicePort: number | undefined;
let shouldPromptProjectOnInit = false;
void MessageEditor;
void MessageList;
void StreamingMessageContainer;
void AssistantMessage;
void UserMessage;

let agent: Agent;
let agentUnsubscribe: (() => void) | undefined;
let autoScrollMessages = true;
let composerValue = "";
let composerAttachments: any[] = [];
let debugLastAction = "idle";
let debugLastError = "";
let debugSendCount = 0;
let isDebugVisible = false;

const generateTitle = (messages: AgentMessage[]): string => {
  const firstUserMessage = messages.find((message) => {
    return message.role === "user" || message.role === "user-with-attachments";
  });

  if (
    !firstUserMessage ||
    (firstUserMessage.role !== "user" && firstUserMessage.role !== "user-with-attachments")
  ) {
    return "";
  }

  let text = "";
  const { content } = firstUserMessage;

  if (typeof content === "string") {
    text = content;
  } else {
    const textBlocks = content.filter((block: any) => block.type === "text");
    text = textBlocks.map((block: any) => block.text || "").join(" ");
  }

  text = text.trim();
  if (!text) return "";

  const sentenceEnd = text.search(/[.!?]/);
  if (sentenceEnd > 0 && sentenceEnd <= 50) {
    return text.substring(0, sentenceEnd + 1);
  }

  return text.length <= 50 ? text : `${text.substring(0, 47)}...`;
};

const shouldSaveSession = (messages: AgentMessage[]): boolean => {
  const hasUserMessage = messages.some((message) => {
    return message.role === "user" || message.role === "user-with-attachments";
  });
  const hasAssistantMessage = messages.some((message) => message.role === "assistant");
  return hasUserMessage && hasAssistantMessage;
};

const updateUrl = (sessionId: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  window.history.replaceState({}, "", url);
};

const formatProviderName = (provider: string) => {
  return provider
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatTokenCount = (value: number) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(value);
};

const formatProjectPath = (relativePath: string) => {
  return relativePath ? `~/${relativePath}` : "~";
};

const generateSessionId = () => {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeModelEntry = (provider: string, model: Model<any>, source: ModelEntry["source"]): ModelEntry => {
  return {
    provider,
    model: {
      ...model,
      provider,
    },
    source,
  };
};

const dedupeModelEntries = (entries: ModelEntry[]) => {
  const deduped = new Map<string, ModelEntry>();
  for (const entry of entries) {
    deduped.set(`${entry.provider}:${entry.model.id}`, entry);
  }
  return Array.from(deduped.values());
};

const sortModelEntries = (entries: ModelEntry[]) => {
  const currentModel = agent?.state.model ?? null;

  return [...entries].sort((a, b) => {
    const aIsCurrent = modelsAreEqual(currentModel, a.model);
    const bIsCurrent = modelsAreEqual(currentModel, b.model);

    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return 1;

    const providerCompare = a.provider.localeCompare(b.provider);
    if (providerCompare !== 0) return providerCompare;

    return a.model.id.localeCompare(b.model.id);
  });
};

const getLoggedInOauthProviderIds = () => {
  return new Set(oauthProviders.filter((provider) => provider.loggedIn).map((provider) => provider.id));
};

const syncOauthMarkers = async () => {
  const loggedInProviders = getLoggedInOauthProviderIds();
  const storedProviders = await storage.providerKeys.list();

  for (const providerId of loggedInProviders) {
    const existingKey = await storage.providerKeys.get(providerId);
    if (!existingKey) {
      await storage.providerKeys.set(providerId, OAUTH_MARKER);
    }
  }

  for (const providerId of storedProviders) {
    const existingKey = await storage.providerKeys.get(providerId);
    if (existingKey === OAUTH_MARKER && !loggedInProviders.has(providerId)) {
      await storage.providerKeys.delete(providerId);
    }
  }
};

const refreshOauthProviders = async () => {
  try {
    oauthProviders = await listOAuthProviders();
    await syncOauthMarkers();
  } catch (error) {
    console.error("Failed to refresh OAuth providers:", error);
    oauthProviders = [];
  }

  renderApp();
};

const persistPreferredModel = async (model: Model<any>) => {
  await storage.settings.set("chat.preferredProvider", model.provider);
  await storage.settings.set("chat.preferredModelId", model.id);
};

const persistSelectedProjectPath = async (projectPath: string) => {
  selectedProjectPath = projectPath;
  await storage.settings.set("chat.selectedProjectPath", projectPath);
};

const loadPersistedProjectPath = async () => {
  selectedProjectPath = (await storage.settings.get<string>("chat.selectedProjectPath")) || "";
};

const applyStartupContext = async () => {
  const startup = await getStartupContext();
  const lastSeenStartupId = window.localStorage.getItem("pi-web-mobile:last-startup-id") || "";

  startupContextId = startup.startupId;
  startupLaunchMode = startup.launchMode || "unknown";
  startupRuntimeMode = startup.runtimeMode || "unknown";
  startupSourceCwd = startup.sourceCwd || "";
  startupDefaultProjectPath = startup.defaultProjectPath || "";
  startupServicePort = startup.servicePort;
  shouldPromptProjectOnInit = false;

  if (startup.startupId !== lastSeenStartupId) {
    if (startup.requireProjectSelection) {
      await persistSelectedProjectPath("");
      shouldPromptProjectOnInit = true;
    } else {
      await persistSelectedProjectPath(startup.defaultProjectPath || "");
    }

    window.localStorage.setItem("pi-web-mobile:last-startup-id", startup.startupId);
  }
};

const hasRealApiKey = async (provider: string) => {
  const apiKey = await storage.providerKeys.get(provider);
  return !!apiKey && apiKey !== OAUTH_MARKER;
};

const discoverOpenAiCompatibleModels = async (
  baseUrl: string,
  apiKey?: string,
): Promise<Model<any>[]> => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const models = Array.isArray(data?.data) ? data.data : [];

  return models.map((model: any) => {
    const contextWindow = model.context_length || model.max_model_len || 8192;
    const maxTokens = model.max_tokens || Math.min(contextWindow, 4096);

    return {
      id: model.id,
      name: model.id,
      api: "openai-completions" as any,
      provider: "",
      baseUrl: `${baseUrl.replace(/\/$/, "")}/v1`,
      reasoning: false,
      input: ["text"],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      contextWindow,
      maxTokens,
    } satisfies Model<any>;
  });
};

const discoverOllamaModels = async (baseUrl: string): Promise<Model<any>[]> => {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const models = Array.isArray(data?.models) ? data.models : [];

  return models.map((model: any) => ({
    id: model.name,
    name: model.name,
    api: "openai-completions" as any,
    provider: "",
    baseUrl: `${baseUrl.replace(/\/$/, "")}/v1`,
    reasoning: false,
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 8192,
    maxTokens: 4096,
  }));
};

const discoverCustomProviderModels = async (
  provider: StoredCustomProvider,
): Promise<Model<any>[]> => {
  switch (provider.type) {
    case "ollama":
      return discoverOllamaModels(provider.baseUrl);
    case "llama.cpp":
    case "vllm":
    case "lmstudio":
      return discoverOpenAiCompatibleModels(provider.baseUrl, provider.apiKey);
    default:
      return provider.models || [];
  }
};

const loadBuiltInAvailableModels = async (): Promise<ModelEntry[]> => {
  const oauthLoggedInProviders = getLoggedInOauthProviderIds();
  const entries: ModelEntry[] = [];

  for (const provider of getProviders() as string[]) {
    if (await hasRealApiKey(provider)) {
      for (const model of getModels(provider as any)) {
        entries.push(normalizeModelEntry(provider, model, "built-in"));
      }
      continue;
    }

    if (oauthLoggedInProviders.has(provider)) {
      const oauthModels = await getOAuthModels(provider);
      for (const model of oauthModels) {
        entries.push(normalizeModelEntry(provider, model, "built-in"));
      }
    }
  }

  return entries;
};

const loadCustomProviderModels = async (): Promise<ModelEntry[]> => {
  const customProviderList = (await storage.customProviders.getAll()) as StoredCustomProvider[];
  const entries: ModelEntry[] = [];

  for (const provider of customProviderList) {
    if (AUTO_DISCOVERY_PROVIDER_TYPES.has(provider.type)) {
      try {
        const discoveredModels = await discoverCustomProviderModels(provider);
        for (const model of discoveredModels) {
          entries.push(normalizeModelEntry(provider.name, model, "custom"));
        }
      } catch (error) {
        console.warn(`Failed to discover models for ${provider.name}:`, error);
      }
      continue;
    }

    for (const model of provider.models || []) {
      entries.push(normalizeModelEntry(provider.name, model, "custom"));
    }
  }

  return entries;
};

const getAvailableModelEntries = async () => {
  const builtInModels = await loadBuiltInAvailableModels();
  const customModels = await loadCustomProviderModels();
  return sortModelEntries(dedupeModelEntries([...builtInModels, ...customModels]));
};

const refreshAvailableModels = async () => {
  modelSheetLoading = true;
  modelSheetError = "";
  renderApp();

  try {
    availableModelEntries = await getAvailableModelEntries();
  } catch (error) {
    availableModelEntries = [];
    modelSheetError = error instanceof Error ? error.message : String(error);
  } finally {
    modelSheetLoading = false;
    renderApp();
  }
};

const resolveDefaultModel = async (): Promise<Model<any>> => {
  const availableEntries = await getAvailableModelEntries();
  const preferredProvider = await storage.settings.get<string>("chat.preferredProvider");
  const preferredModelId = await storage.settings.get<string>("chat.preferredModelId");

  if (preferredProvider && preferredModelId) {
    const preferredModel = availableEntries.find((entry) => {
      return entry.provider === preferredProvider && entry.model.id === preferredModelId;
    });

    if (preferredModel) {
      return preferredModel.model;
    }
  }

  return availableEntries[0]?.model || FALLBACK_MODEL;
};

const getFilteredModelEntries = () => {
  const query = modelSheetSearch.trim().toLowerCase();
  if (!query) {
    return availableModelEntries;
  }

  const queryParts = query.split(/\s+/g).filter(Boolean);
  return availableModelEntries.filter(({ provider, model }) => {
    const haystack = `${provider} ${model.id} ${model.name}`.toLowerCase();
    return queryParts.every((part) => haystack.includes(part));
  });
};

const openModelSheet = async () => {
  modelSheetSearch = "";
  isModelSheetOpen = true;
  renderApp();
  await refreshAvailableModels();
  requestAnimationFrame(() => {
    const input = document.getElementById("model-search-input") as HTMLInputElement | null;
    input?.focus();
  });
};

const closeModelSheet = () => {
  isModelSheetOpen = false;
  modelSheetSearch = "";
  renderApp();
};

const selectModel = async (model: Model<any>) => {
  if (!agent) return;
  agent.state.model = model;
  await persistPreferredModel(model);
  if (currentSessionId) {
    void saveSession();
  }
  closeModelSheet();
  renderApp();
};

const loadProjectDirectory = async (projectPath = selectedProjectPath) => {
  projectSheetLoading = true;
  projectSheetError = "";
  renderApp();

  try {
    projectDirectory = await listProjectDirectories(projectPath);
  } catch (error) {
    projectDirectory = null;
    projectSheetError = error instanceof Error ? error.message : String(error);
  } finally {
    projectSheetLoading = false;
    renderApp();
  }
};

const openProjectSheet = async () => {
  isProjectSheetOpen = true;
  await loadProjectDirectory(selectedProjectPath);
};

const closeProjectSheet = () => {
  isProjectSheetOpen = false;
  projectSheetError = "";
  renderApp();
};

const selectProject = async (projectPath: string) => {
  await persistSelectedProjectPath(projectPath);
  if (currentSessionId) {
    void saveSession();
  }
  closeProjectSheet();
};

const refreshHistorySessions = async () => {
  historySheetLoading = true;
  historySheetError = "";
  renderApp();

  try {
    const browserSessions = (await storage.sessions.getAllMetadata())
      .filter((session: any) => (session.projectPath || "") === selectedProjectPath)
      .map((session: any) => ({
        source: "browser" as const,
        id: session.id,
        title: session.title || session.preview || "Untitled session",
        preview: session.preview || "(no preview)",
        lastModified: session.lastModified,
        projectPath: session.projectPath || "",
      }));

    const piSessions = (await listPiSessions(selectedProjectPath)).map((session: PiSessionListItem) => ({
      source: "pi" as const,
      id: session.id,
      title: session.title,
      preview: session.preview,
      lastModified: session.lastModified,
      projectPath: session.projectPath,
      path: session.path,
    }));

    historySessions = [...browserSessions, ...piSessions].sort((a, b) => {
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    });
  } catch (error) {
    historySessions = [];
    historySheetError = error instanceof Error ? error.message : String(error);
  } finally {
    historySheetLoading = false;
    renderApp();
  }
};

const openHistorySheet = async () => {
  isHistorySheetOpen = true;
  await refreshHistorySessions();
};

const closeHistorySheet = () => {
  isHistorySheetOpen = false;
  renderApp();
};

const syncPiSessionIfNeeded = async () => {
  if (!currentPiSessionPath || !agent || isSyncingPiSession || agent.state.isStreaming) return;

  const messagesToSync = agent.state.messages
    .slice(currentPiSyncedMessageCount)
    .filter((message: any) => ["user", "assistant", "toolResult"].includes(message.role));

  const model = agent.state.model;
  const title = currentTitle || generateTitle(agent.state.messages) || "Untitled session";
  const needsSync =
    messagesToSync.length > 0 ||
    title !== currentTitle ||
    currentPiSyncedMessageCount === 0;

  if (!needsSync) return;

  isSyncingPiSession = true;
  try {
    await appendPiSession({
      path: currentPiSessionPath,
      title,
      thinkingLevel: agent.state.thinkingLevel,
      model: model ? { provider: model.provider, id: model.id } : null,
      messages: messagesToSync,
    });
    currentPiSyncedMessageCount = agent.state.messages.length;
  } catch (error) {
    console.error("Failed to sync pi session:", error);
  } finally {
    isSyncingPiSession = false;
  }
};

const loadHistorySession = async (session: HistorySessionItem) => {
  closeHistorySheet();

  if (session.source === "browser") {
    currentPiSessionPath = undefined;
    currentPiSyncedMessageCount = 0;
    await loadSession(session.id);
    return;
  }

  if (!session.path) return;

  const piSession = await loadPiSession(session.path);
  currentSessionId = undefined;
  currentPiSessionPath = piSession.path;
  currentPiSyncedMessageCount = piSession.messages.length;
  currentTitle = piSession.title;
  await persistSelectedProjectPath(piSession.projectPath || "");

  await createAgent({
    model: piSession.model,
    thinkingLevel: (piSession.thinkingLevel as any) || "off",
    messages: piSession.messages,
    tools: [],
  });

  const url = new URL(window.location.href);
  url.searchParams.delete("session");
  window.history.replaceState({}, "", url);
  renderApp();
};

const saveSession = async () => {
  if (!storage.sessions || !currentSessionId || !agent || !currentTitle) return;

  const state = agent.state;
  if (!shouldSaveSession(state.messages)) return;

  try {
    const now = new Date().toISOString();

    const sessionData = {
      id: currentSessionId,
      title: currentTitle,
      model: state.model!,
      thinkingLevel: state.thinkingLevel,
      messages: state.messages,
      createdAt: now,
      lastModified: now,
      projectPath: selectedProjectPath,
    } as any;

    const metadata = {
      id: currentSessionId,
      title: currentTitle,
      createdAt: now,
      lastModified: now,
      messageCount: state.messages.length,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      modelId: state.model?.id || null,
      thinkingLevel: state.thinkingLevel,
      preview: generateTitle(state.messages),
      projectPath: selectedProjectPath,
    } as any;

    await storage.sessions.save(sessionData, metadata);
  } catch (error) {
    console.error("Failed to save session:", error);
  }
};

const setDebugAction = (action: string, error = "") => {
  debugLastAction = action;
  debugLastError = error;
  console.debug(`[piweb] ${action}`, error || "");
};

const getToolResultsById = () => {
  const map = new Map<string, any>();
  for (const message of agent?.state.messages || []) {
    if ((message as any).role === "toolResult") {
      map.set((message as any).toolCallId, message as any);
    }
  }
  return map;
};

const getUsageTotalsText = () => {
  if (!agent) return "";

  const totals = agent.state.messages
    .filter((message: any) => message.role === "assistant" && message.usage)
    .reduce(
      (acc: any, message: any) => {
        acc.input += message.usage.input || 0;
        acc.output += message.usage.output || 0;
        acc.cacheRead += message.usage.cacheRead || 0;
        acc.cacheWrite += message.usage.cacheWrite || 0;
        acc.totalTokens += message.usage.totalTokens || 0;
        acc.cost.total += message.usage.cost?.total || 0;
        return acc;
      },
      {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    );

  return totals.input || totals.output || totals.cacheRead || totals.cacheWrite
    ? formatUsage(totals)
    : "";
};

const scrollMessagesToBottom = () => {
  if (!autoScrollMessages) return;
  requestAnimationFrame(() => {
    const container = document.getElementById("chat-scroll-container");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
};

const handleMessagesScroll = (event: Event) => {
  const element = event.currentTarget as HTMLElement;
  const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
  autoScrollMessages = distanceFromBottom < 80;
};

const resetComposerUi = () => {
  composerValue = "";
  composerAttachments = [];

  requestAnimationFrame(() => {
    const editor = document.querySelector("message-editor") as any;
    if (editor) {
      editor.value = "";
      editor.attachments = [];
      editor.requestUpdate?.();
    }
  });
};

const sendComposerMessage = async (inputValue?: string, attachmentsValue?: any[]) => {
  if (!agent) {
    setDebugAction("send-blocked:no-agent");
    renderApp();
    return;
  }

  if (agent.state.isStreaming) {
    setDebugAction("send-blocked:is-streaming");
    renderApp();
    return;
  }

  const input = inputValue ?? composerValue;
  const attachments = [...(attachmentsValue ?? composerAttachments)];
  if (!input.trim() && attachments.length === 0) {
    setDebugAction("send-blocked:empty-input");
    renderApp();
    return;
  }

  const provider = agent.state.model?.provider;
  if (!provider) {
    setDebugAction("send-blocked:no-provider");
    renderApp();
    return;
  }

  debugSendCount += 1;
  setDebugAction(`send-start:${provider}:${debugSendCount}`);

  const hasOauth = getLoggedInOauthProviderIds().has(provider);
  const storedApiKey = await storage.providerKeys.get(provider);
  const hasApiKey = !!storedApiKey && storedApiKey !== OAUTH_MARKER;

  if (!hasOauth && !hasApiKey) {
    setDebugAction(`send-auth-required:${provider}`);
    const success = await ApiKeyPromptDialog.prompt(provider);
    if (!success) {
      setDebugAction(`send-cancelled-auth:${provider}`);
      renderApp();
      return;
    }
  }

  resetComposerUi();
  autoScrollMessages = true;
  renderApp();

  try {
    if (attachments.length > 0) {
      const message: UserMessageWithAttachments = {
        role: "user-with-attachments",
        content: input,
        attachments,
        timestamp: Date.now(),
      };
      await agent.prompt(message);
    } else {
      await agent.prompt(input);
    }
    setDebugAction(`send-success:${provider}`);
    resetComposerUi();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send message:", error);
    setDebugAction(`send-error:${provider}`, message);
    if (agent) {
      agent.steer(createSystemNotification(message, "destructive"));
    }
    renderApp();
  }
};

const renderChatPanel = () => {
  const state = agent?.state;
  const usageText = getUsageTotalsText();
  const toolResultsById = getToolResultsById();
  const provider = state?.model?.provider || "-";
  const modelId = state?.model?.id || "-";
  const authMode = getLoggedInOauthProviderIds().has(provider)
    ? "oauth"
    : provider !== "-"
      ? "api-key/local"
      : "-";
  const messages = [...(state?.messages || [])];
  const tools = [...(state?.tools || [])];
  const pendingToolCalls = new Set(state?.pendingToolCalls || []);
  const streamingAssistant =
    state?.streamingMessage && (state.streamingMessage as any).role === "assistant"
      ? (state.streamingMessage as any)
      : null;
  const streamingContent = Array.isArray(streamingAssistant?.content)
    ? streamingAssistant.content
    : [];
  const streamingTextBlocks = streamingContent.filter((block: any) => block.type === "text").length;
  const streamingThinkingBlocks = streamingContent.filter((block: any) => block.type === "thinking").length;
  const streamingToolBlocks = streamingContent.filter((block: any) => block.type === "toolCall").length;
  const hasVisibleThinking = streamingContent.some(
    (block: any) => block.type === "thinking" && (block.thinking || "").trim().length > 0,
  );
  const startupProjectLabel = startupDefaultProjectPath || "~";
  const startupSourceLabel = startupSourceCwd || "-";

  return html`
    <div class="mobile-chat-panel">
      <div
        id="chat-scroll-container"
        class="mobile-chat-messages"
        @scroll=${handleMessagesScroll}
      >
        <div class="mobile-chat-messages-inner">
          <message-list
            .messages=${messages}
            .tools=${tools}
            .pendingToolCalls=${pendingToolCalls}
            .isStreaming=${state?.isStreaming || false}
          ></message-list>

          ${streamingAssistant
            ? html`
                <assistant-message
                  .message=${streamingAssistant}
                  .tools=${tools}
                  .isStreaming=${state?.isStreaming || false}
                  .pendingToolCalls=${pendingToolCalls}
                  .toolResultsById=${toolResultsById}
                  .hideToolCalls=${false}
                  .hidePendingToolCalls=${false}
                ></assistant-message>
              `
            : html``}
        </div>
      </div>

      <div class="mobile-chat-footer">
        <div class="mobile-chat-feedback-row">
          <div class="mobile-chat-project-chip">${formatProjectPath(selectedProjectPath)}</div>
          <div class="mobile-chat-feedback-actions">
            ${usageText ? html`<div class="mobile-chat-usage">${usageText}</div>` : html``}
            <button
              class="mobile-debug-toggle"
              @click=${() => {
                isDebugVisible = !isDebugVisible;
                renderApp();
              }}
            >
              ${isDebugVisible ? "Hide debug" : "Show debug"}
            </button>
          </div>
        </div>
        <div class="mobile-chat-status-row" title=${`startup:${startupContextId}`}>
          <span class="mobile-chat-status-chip">launch:${startupLaunchMode}</span>
          <span class="mobile-chat-status-chip">runtime:${startupRuntimeMode}</span>
          <span class="mobile-chat-status-chip">transport:server-stream</span>
        </div>
        ${isDebugVisible
          ? html`<div class="mobile-chat-debug-bar">
              <span>provider: ${provider}</span>
              <span>model: ${modelId}</span>
              <span>auth: ${authMode}</span>
              <span>msgs: ${state?.messages?.length || 0}</span>
              <span>stream: ${state?.isStreaming ? "yes" : "no"}</span>
              <span>stream-msg: ${streamingAssistant ? "assistant" : "none"}</span>
              <span>text-blocks: ${streamingTextBlocks}</span>
              <span>thinking-blocks: ${streamingThinkingBlocks}</span>
              <span>tool-blocks: ${streamingToolBlocks}</span>
              <span>visible-thinking: ${hasVisibleThinking ? "yes" : "no"}</span>
              <span>action: ${debugLastAction}</span>
              <span>startup-id: ${startupContextId || "-"}</span>
              <span>startup-project: ${startupProjectLabel}</span>
              <span>startup-cwd: ${startupSourceLabel}</span>
              <span>runtime-mode: ${startupRuntimeMode}</span>
              <span>service-port: ${startupServicePort ?? "-"}</span>
              ${debugLastError ? html`<span class="is-error">err: ${debugLastError}</span>` : html``}
            </div>`
          : html``}
        <div class="mobile-chat-composer-shell">
          <message-editor
            .value=${composerValue}
            .attachments=${composerAttachments}
            .isStreaming=${state?.isStreaming || false}
            .currentModel=${state?.model}
            .thinkingLevel=${state?.thinkingLevel || "off"}
            .showAttachmentButton=${true}
            .showModelSelector=${true}
            .showThinkingSelector=${true}
            .onInput=${(value: string) => {
              composerValue = value;
            }}
            .onSend=${(input: string, attachments: any[]) => {
              void sendComposerMessage(input, attachments);
            }}
            .onAbort=${() => agent?.abort()}
            .onModelSelect=${() => {
              void openModelSheet();
            }}
            .onThinkingChange=${(level: any) => {
              if (agent) {
                agent.state.thinkingLevel = level;
              }
              renderApp();
            }}
            .onFilesChange=${(files: any[]) => {
              composerAttachments = files;
            }}
          ></message-editor>
        </div>
      </div>
    </div>
  `;
};

const createSettingsTabs = (): SettingsTab[] => {
  const subscriptionTab = new SubscriptionAuthTab();
  subscriptionTab.onStatusChange = async () => {
    await refreshOauthProviders();
    await refreshAvailableModels();
  };

  return [new ProvidersModelsTab(), subscriptionTab, new ProxyTab()];
};

const createAgent = async (initialState?: Partial<AgentState>) => {
  if (agentUnsubscribe) {
    agentUnsubscribe();
  }

  const defaultModel = initialState?.model ?? (await resolveDefaultModel());
  const projectInstruction = `Current project folder: ${formatProjectPath(selectedProjectPath)}`;
  const resolvedInitialState: Partial<AgentState> = initialState
    ? {
        systemPrompt:
          initialState.systemPrompt ||
          `You are a helpful AI assistant with access to various tools.

${projectInstruction}

Available tools:
- JavaScript REPL: Execute JavaScript code in a sandboxed browser environment.
- Artifacts: Create interactive HTML, SVG, Markdown, and text artifacts.

Use the available tools when they help you answer more accurately.`,
        model: initialState.model ?? defaultModel,
        thinkingLevel: initialState.thinkingLevel ?? "off",
        messages: initialState.messages ?? [],
        tools: initialState.tools ?? [],
      }
    : {
        systemPrompt: `You are a helpful AI assistant with access to various tools.

${projectInstruction}

Available tools:
- JavaScript REPL: Execute JavaScript code in a sandboxed browser environment.
- Artifacts: Create interactive HTML, SVG, Markdown, and text artifacts.

Use the available tools when they help you answer more accurately.`,
        model: defaultModel,
        thinkingLevel: "off",
        messages: [],
        tools: [],
      };

  agent = new Agent({
    initialState: resolvedInitialState,
    convertToLlm: customConvertToLlm,
    streamFn: createServerStreamFn(),
  });

  agent.getApiKey = async (provider: string) => {
    const storedApiKey = await storage.providerKeys.get(provider);
    if (storedApiKey && storedApiKey !== OAUTH_MARKER) {
      return storedApiKey;
    }

    if (getLoggedInOauthProviderIds().has(provider)) {
      return await getOAuthApiKey(provider);
    }

    return undefined;
  };

  if (!initialState?.model) {
    void persistPreferredModel(defaultModel);
  }

  const replTool = createJavaScriptReplTool();
  (replTool as any).runtimeProvidersFactory = () => [];
  agent.state.tools = [replTool];

  agentUnsubscribe = agent.subscribe((event: AgentEvent) => {
    setDebugAction(`event:${event.type}`);
    const messages = [...agent.state.messages];

    if (!currentTitle && shouldSaveSession(messages)) {
      currentTitle = generateTitle(messages);
    }

    if (!currentSessionId && !currentPiSessionPath && shouldSaveSession(messages)) {
      currentSessionId = generateSessionId();
      updateUrl(currentSessionId);
    }

    if (currentSessionId && (event.type === "message_end" || event.type === "turn_end" || event.type === "agent_end")) {
      void saveSession();
    }

    if (currentPiSessionPath && event.type === "agent_end") {
      void syncPiSessionIfNeeded();
    }

    renderApp();
    if (event.type === "message_update" || event.type === "message_end" || event.type === "agent_end") {
      scrollMessagesToBottom();
    }

    if (event.type === "agent_end") {
      setTimeout(() => {
        setDebugAction("idle");
        renderApp();
        scrollMessagesToBottom();
      }, 0);
    }
  });

  setDebugAction("agent-ready");
  renderApp();
  scrollMessagesToBottom();
};

const loadSession = async (sessionId: string): Promise<boolean> => {
  if (!storage.sessions) return false;

  const sessionData = await storage.sessions.get(sessionId);
  if (!sessionData) {
    console.error("Session not found:", sessionId);
    return false;
  }

  currentSessionId = sessionId;
  currentPiSessionPath = undefined;
  currentPiSyncedMessageCount = 0;
  const metadata = await storage.sessions.getMetadata(sessionId);
  currentTitle = metadata?.title || "";
  selectedProjectPath = (sessionData as any).projectPath || selectedProjectPath;
  await persistSelectedProjectPath(selectedProjectPath);

  await createAgent({
    model: sessionData.model,
    thinkingLevel: sessionData.thinkingLevel,
    messages: sessionData.messages,
    tools: [],
  });

  updateUrl(sessionId);
  renderApp();
  return true;
};

const newSession = () => {
  const url = new URL(window.location.href);
  url.search = "";
  window.location.href = url.toString();
};

const renderHistorySheet = () => {
  if (!isHistorySheetOpen) return html``;

  return html`
    <div
      class="model-sheet-backdrop"
      @click=${(event: Event) => {
        if (event.target === event.currentTarget) {
          closeHistorySheet();
        }
      }}
    >
      <div class="model-sheet project-sheet">
        <div class="model-sheet-handle"></div>

        <div class="model-sheet-header">
          <div>
            <div class="model-sheet-kicker">History</div>
            <h2>Session history</h2>
            <p>Menampilkan session browser dan session dari pi coding agent untuk project ini.</p>
          </div>
          <button class="model-sheet-close" @click=${closeHistorySheet} aria-label="Tutup history">
            ${icon(X, "sm")}
          </button>
        </div>

        <div class="project-current-row history-current-row">
          <div class="project-current-path">${formatProjectPath(selectedProjectPath)}</div>
          <button class="subscription-secondary-button" @click=${() => void refreshHistorySessions()}>
            Refresh
          </button>
        </div>

        ${historySheetLoading
          ? html`<div class="model-sheet-state">Memuat session…</div>`
          : historySheetError
            ? html`<div class="model-sheet-state is-error">${historySheetError}</div>`
            : html`
                <div class="model-sheet-content">
                  ${historySessions.length === 0
                    ? html`
                        <div class="model-sheet-empty">
                          <div class="model-sheet-empty-title">Belum ada session</div>
                          <p>Belum ada session browser atau session pi coding agent untuk project ini.</p>
                        </div>
                      `
                    : html`
                        <section class="model-section">
                          <div class="model-section-title">Daftar session</div>
                          <div class="model-section-list">
                            ${historySessions.map((session) => {
                              const isCurrentBrowser =
                                session.source === "browser" && session.id === currentSessionId;
                              const isCurrentPi = session.source === "pi" && session.path === currentPiSessionPath;
                              const isCurrent = isCurrentBrowser || isCurrentPi;
                              return html`
                                <button
                                  class="model-card ${isCurrent ? "is-current" : ""}"
                                  @click=${() => {
                                    void loadHistorySession(session);
                                  }}
                                >
                                  <div class="model-card-top">
                                    <div class="model-card-copy">
                                      <div class="model-card-name">${session.title}</div>
                                      <div class="model-card-subtitle">${session.preview}</div>
                                    </div>
                                    ${isCurrent
                                      ? html`<span class="model-card-check">${icon(Check, "sm")}</span>`
                                      : html``}
                                  </div>
                                  <div class="model-card-meta">
                                    <span>${session.source === "pi" ? "pi" : "browser"}</span>
                                    <span>${new Date(session.lastModified).toLocaleString()}</span>
                                  </div>
                                </button>
                              `;
                            })}
                          </div>
                        </section>
                      `}
                </div>
              `}
      </div>
    </div>
  `;
};

const renderProjectSheet = () => {
  if (!isProjectSheetOpen) return html``;

  return html`
    <div
      class="model-sheet-backdrop"
      @click=${(event: Event) => {
        if (event.target === event.currentTarget) {
          closeProjectSheet();
        }
      }}
    >
      <div class="model-sheet project-sheet">
        <div class="model-sheet-handle"></div>

        <div class="model-sheet-header">
          <div>
            <div class="model-sheet-kicker">Project</div>
            <h2>Pilih folder project</h2>
            <p>Hanya bisa memilih folder yang berada di bawah home directory.</p>
          </div>
          <button class="model-sheet-close" @click=${closeProjectSheet} aria-label="Tutup project picker">
            ${icon(X, "sm")}
          </button>
        </div>

        ${projectDirectory
          ? html`
              <div class="project-current-row">
                <button
                  class="project-nav-button"
                  ?disabled=${projectDirectory!.parentPath === null}
                  @click=${() => {
                    if (projectDirectory?.parentPath !== null) {
                      void loadProjectDirectory(projectDirectory!.parentPath || "");
                    }
                  }}
                >
                  ${icon(ChevronLeft, "sm")}
                </button>
                <div class="project-current-path">${projectDirectory!.displayPath}</div>
                <button
                  class="subscription-primary-button"
                  @click=${() => {
                    if (projectDirectory) {
                      void selectProject(projectDirectory!.path);
                    }
                  }}
                >
                  Pilih folder ini
                </button>
              </div>
            `
          : html``}

        ${projectSheetLoading
          ? html`<div class="model-sheet-state">Memuat folder project…</div>`
          : projectSheetError
            ? html`<div class="model-sheet-state is-error">${projectSheetError}</div>`
            : html`
                <div class="model-sheet-content">
                  ${(projectDirectory?.entries || []).length === 0
                    ? html`
                        <div class="model-sheet-empty">
                          <div class="model-sheet-empty-title">Folder kosong</div>
                          <p>Tidak ada subfolder yang bisa dipilih di lokasi ini.</p>
                        </div>
                      `
                    : html`
                        <section class="model-section">
                          <div class="model-section-title">Subfolder</div>
                          <div class="model-section-list">
                            ${(projectDirectory?.entries || []).map((entry) => {
                              const isCurrent = entry.path === selectedProjectPath;
                              return html`
                                <button
                                  class="model-card ${isCurrent ? "is-current" : ""}"
                                  @click=${() => {
                                    void loadProjectDirectory(entry.path);
                                  }}
                                >
                                  <div class="model-card-top">
                                    <div class="model-card-copy">
                                      <div class="model-card-name">${entry.name}</div>
                                      <div class="model-card-subtitle">${formatProjectPath(entry.path)}</div>
                                    </div>
                                    ${isCurrent
                                      ? html`<span class="model-card-check">${icon(Check, "sm")}</span>`
                                      : html``}
                                  </div>
                                  <div class="model-card-meta">
                                    <span>Buka folder</span>
                                  </div>
                                </button>
                              `;
                            })}
                          </div>
                        </section>
                      `}
                </div>
              `}
      </div>
    </div>
  `;
};

const renderModelSheet = () => {
  if (!isModelSheetOpen) return html``;

  const filteredEntries = getFilteredModelEntries();
  const groupedEntries = new Map<string, ModelEntry[]>();

  for (const entry of filteredEntries) {
    const group = groupedEntries.get(entry.provider) || [];
    group.push(entry);
    groupedEntries.set(entry.provider, group);
  }

  return html`
    <div
      class="model-sheet-backdrop"
      @click=${(event: Event) => {
        if (event.target === event.currentTarget) {
          closeModelSheet();
        }
      }}
    >
      <div class="model-sheet">
        <div class="model-sheet-handle"></div>

        <div class="model-sheet-header">
          <div>
            <div class="model-sheet-kicker">Model</div>
            <h2>Pilih model</h2>
            <p>Model muncul kalau provider aktif lewat API key atau subscription login.</p>
          </div>
          <button class="model-sheet-close" @click=${closeModelSheet} aria-label="Tutup model picker">
            ${icon(X, "sm")}
          </button>
        </div>

        <label class="model-sheet-search" for="model-search-input">
          <span class="model-sheet-search-icon">${icon(Search, "sm")}</span>
          <input
            id="model-search-input"
            type="text"
            placeholder="Cari model atau provider"
            .value=${modelSheetSearch}
            @input=${(event: Event) => {
              modelSheetSearch = (event.target as HTMLInputElement).value;
              renderApp();
            }}
          />
        </label>

        ${modelSheetLoading
          ? html`<div class="model-sheet-state">Memuat model yang tersedia…</div>`
          : modelSheetError
            ? html`<div class="model-sheet-state is-error">${modelSheetError}</div>`
            : filteredEntries.length === 0
              ? html`
                  <div class="model-sheet-empty">
                    <div class="model-sheet-empty-title">Belum ada model aktif</div>
                    <p>
                      Tambahkan API key atau login subscription dulu di Settings agar provider dan model
                      muncul di sini.
                    </p>
                    <button
                      class="model-sheet-primary"
                      @click=${() => {
                        closeModelSheet();
                        SettingsDialog.open(createSettingsTabs(), () => {
                          void refreshOauthProviders();
                          void refreshAvailableModels();
                        });
                      }}
                    >
                      Buka Settings
                    </button>
                  </div>
                `
              : html`
                  <div class="model-sheet-content">
                    ${Array.from(groupedEntries.entries()).map(([provider, entries]) => {
                      return html`
                        <section class="model-section">
                          <div class="model-section-title">${formatProviderName(provider)}</div>
                          <div class="model-section-list">
                            ${entries.map((entry) => {
                              const isCurrent = modelsAreEqual(agent?.state.model ?? null, entry.model);

                              return html`
                                <button
                                  class="model-card ${isCurrent ? "is-current" : ""}"
                                  @click=${() => {
                                    void selectModel(entry.model);
                                  }}
                                >
                                  <div class="model-card-top">
                                    <div class="model-card-copy">
                                      <div class="model-card-name">${entry.model.id}</div>
                                      <div class="model-card-subtitle">${entry.model.name}</div>
                                    </div>
                                    ${isCurrent
                                      ? html`<span class="model-card-check">${icon(Check, "sm")}</span>`
                                      : html``}
                                  </div>

                                  <div class="model-card-meta">
                                    <span>${entry.model.reasoning ? "Thinking" : "Standard"}</span>
                                    <span>${entry.model.input.includes("image") ? "Vision" : "Text"}</span>
                                    <span>${formatTokenCount(entry.model.contextWindow)} ctx</span>
                                    ${entry.source === "custom" ? html`<span>Custom</span>` : html``}
                                  </div>
                                </button>
                              `;
                            })}
                          </div>
                        </section>
                      `;
                    })}
                  </div>
                `}
      </div>
    </div>
  `;
};

const renderApp = () => {
  const app = document.getElementById("app");
  if (!app) return;

  const currentModel = agent?.state.model;
  const modelSubtitle = currentModel
    ? `${formatProviderName(currentModel.provider)} · ${currentModel.id}`
    : "Belum ada model";

  const appHtml = html`
    <div class="claude-mobile-shell w-full h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      <div class="mobile-topbar border-b border-border/70 shrink-0">
        <div class="flex items-center justify-between gap-3 px-3 py-3">
          <div class="flex min-w-0 items-center gap-2">
            <button
              class="topbar-icon-button"
              @click=${() => void openHistorySheet()}
              title="Sessions"
            >
              ${icon(History, "sm")}
            </button>

            <button class="topbar-icon-button" @click=${() => void openProjectSheet()} title="Project">
              ${icon(Folder, "sm")}
            </button>

            <button class="topbar-icon-button" @click=${newSession} title="New Session">
              ${icon(Plus, "sm")}
            </button>

            <div class="topbar-title-stack min-w-0">
              ${currentTitle
                ? isEditingTitle
                  ? html`<div class="flex items-center gap-2">
                      ${Input({
                        type: "text",
                        value: currentTitle,
                        className: "text-sm w-64",
                        onChange: async (event: Event) => {
                          const newTitle = (event.target as HTMLInputElement).value.trim();
                          if (
                            newTitle &&
                            newTitle !== currentTitle &&
                            storage.sessions &&
                            currentSessionId
                          ) {
                            await storage.sessions.updateTitle(currentSessionId, newTitle);
                            currentTitle = newTitle;
                          }
                          isEditingTitle = false;
                          renderApp();
                        },
                        onKeyDown: async (event: KeyboardEvent) => {
                          if (event.key === "Enter") {
                            const newTitle = (event.target as HTMLInputElement).value.trim();
                            if (
                              newTitle &&
                              newTitle !== currentTitle &&
                              storage.sessions &&
                              currentSessionId
                            ) {
                              await storage.sessions.updateTitle(currentSessionId, newTitle);
                              currentTitle = newTitle;
                            }
                            isEditingTitle = false;
                            renderApp();
                          } else if (event.key === "Escape") {
                            isEditingTitle = false;
                            renderApp();
                          }
                        },
                      })}
                    </div>`
                  : html`<button
                      class="topbar-title-button"
                      @click=${() => {
                        isEditingTitle = true;
                        renderApp();
                        requestAnimationFrame(() => {
                          const input = app?.querySelector('input[type="text"]') as HTMLInputElement;
                          if (input) {
                            input.focus();
                            input.select();
                          }
                        });
                      }}
                      title="Ubah judul"
                    >
                      ${currentTitle}
                    </button>`
                : html`<div class="topbar-title-button is-static">New chat</div>`}

              <div class="topbar-subtitle">${formatProjectPath(selectedProjectPath)} · ${modelSubtitle}</div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              class="topbar-icon-button"
              @click=${() => {
                if (agent) {
                  agent.steer(
                    createSystemNotification(
                      "Ini contoh custom message. Tampil di UI, tapi tidak wajib dikirim apa adanya ke LLM.",
                    ),
                  );
                }
              }}
              title="Demo custom notification"
            >
              ${icon(Bell, "sm")}
            </button>

            <theme-toggle></theme-toggle>

            <button
              class="topbar-icon-button"
              @click=${() => {
                SettingsDialog.open(createSettingsTabs(), () => {
                  void refreshOauthProviders();
                  void refreshAvailableModels();
                });
              }}
              title="Settings"
            >
              ${icon(Settings, "sm")}
            </button>
          </div>
        </div>
      </div>

      <div class="chat-shell">${renderChatPanel()}</div>
      ${renderModelSheet()} ${renderHistorySheet()} ${renderProjectSheet()}
    </div>
  `;

  render(appHtml, app);
};

async function initApp() {
  const app = document.getElementById("app");
  if (!app) throw new Error("App container not found");

  render(
    html`
      <div class="w-full h-screen flex items-center justify-center bg-background text-foreground">
        <div class="text-muted-foreground">Loading...</div>
      </div>
    `,
    app,
  );

  await loadPersistedProjectPath();
  await applyStartupContext();
  await refreshOauthProviders();

  const urlParams = new URLSearchParams(window.location.search);
  const sessionIdFromUrl = urlParams.get("session");

  if (sessionIdFromUrl) {
    const loaded = await loadSession(sessionIdFromUrl);
    if (!loaded) {
      newSession();
      return;
    }
  } else {
    await createAgent();
  }

  renderApp();

  if (shouldPromptProjectOnInit) {
    void openProjectSheet();
  }
}

void initApp();
