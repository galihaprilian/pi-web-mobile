import { html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SettingsTab } from "@mariozechner/pi-web-ui";
import type { OAuthProviderStatus, OAuthSessionState } from "./local-api";
import {
  getOAuthSession,
  listOAuthProviders,
  logoutOAuthProvider,
  startOAuthLogin,
  submitOAuthSessionInput,
} from "./local-api";

@customElement("subscription-auth-tab")
export class SubscriptionAuthTab extends SettingsTab {
  @property({ attribute: false }) onStatusChange?: () => void | Promise<void>;
  @state() private providers: OAuthProviderStatus[] = [];
  @state() private loading = true;
  @state() private error = "";
  @state() private activeSession: OAuthSessionState | null = null;
  @state() private promptValue = "";

  private pollHandle: number | undefined;

  getTabName(): string {
    return "Subscription";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void this.loadProviders();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.pollHandle) {
      window.clearTimeout(this.pollHandle);
      this.pollHandle = undefined;
    }
  }

  private async loadProviders() {
    this.loading = true;
    this.error = "";

    try {
      this.providers = await listOAuthProviders();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
    }
  }

  private schedulePoll(sessionId: string) {
    if (this.pollHandle) {
      window.clearTimeout(this.pollHandle);
    }

    this.pollHandle = window.setTimeout(async () => {
      await this.refreshSession(sessionId);
    }, 1200);
  }

  private async refreshSession(sessionId: string) {
    try {
      const session = await getOAuthSession(sessionId);
      this.activeSession = session;

      if (session.status === "completed") {
        await this.loadProviders();
        await this.onStatusChange?.();
        this.promptValue = "";
        this.pollHandle = undefined;
        return;
      }

      if (session.status === "error") {
        this.pollHandle = undefined;
        return;
      }

      this.schedulePoll(sessionId);
    } catch (error) {
      this.activeSession = {
        id: sessionId,
        providerId: "",
        providerName: "",
        status: "error",
        messages: [],
        error: error instanceof Error ? error.message : String(error),
      };
      this.pollHandle = undefined;
    }
  }

  private async login(providerId: string) {
    this.error = "";
    this.promptValue = "";

    try {
      const { sessionId } = await startOAuthLogin(providerId);
      await this.refreshSession(sessionId);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private async submitPrompt() {
    if (!this.activeSession?.prompt) return;
    const value = this.promptValue.trim();
    if (!value && !this.activeSession.prompt.allowEmpty) return;

    await submitOAuthSessionInput(this.activeSession.id, this.promptValue);
    this.promptValue = "";
    await this.refreshSession(this.activeSession.id);
  }

  private async logout(providerId: string) {
    await logoutOAuthProvider(providerId);
    await this.loadProviders();
    await this.onStatusChange?.();
  }

  private renderSessionCard(): TemplateResult {
    const session = this.activeSession;
    if (!session) return html``;

    return html`
      <div class="subscription-card active">
        <div class="subscription-card-header">
          <div>
            <div class="subscription-card-title">${session.providerName || "Subscription login"}</div>
            <div class="subscription-card-subtitle">Status: ${session.status}</div>
          </div>
        </div>

        ${session.authInfo
          ? html`
              <div class="subscription-auth-box">
                <a href=${session.authInfo.url} target="_blank" rel="noreferrer">Buka halaman login</a>
                ${session.authInfo.instructions
                  ? html`<div class="subscription-help">${session.authInfo.instructions}</div>`
                  : html``}
              </div>
            `
          : html``}

        ${session.prompt
          ? html`
              <div class="subscription-prompt-box">
                <div class="subscription-help">${session.prompt.message}</div>
                <input
                  class="subscription-input"
                  type="text"
                  .value=${this.promptValue}
                  placeholder=${session.prompt.placeholder || "Masukkan nilai"}
                  @input=${(event: Event) => {
                    this.promptValue = (event.target as HTMLInputElement).value;
                  }}
                  @keydown=${async (event: KeyboardEvent) => {
                    if (event.key === "Enter") {
                      await this.submitPrompt();
                    }
                  }}
                />
                <button class="subscription-primary-button" @click=${() => void this.submitPrompt()}>
                  Kirim
                </button>
              </div>
            `
          : html``}

        ${session.messages.length > 0
          ? html`
              <div class="subscription-log-list">
                ${session.messages.slice(-6).map(
                  (message) => html`<div class="subscription-log-item">${message}</div>`,
                )}
              </div>
            `
          : html``}

        ${session.status === "completed"
          ? html`<div class="subscription-success">Login berhasil. Provider siap dipakai.</div>`
          : html``}
        ${session.error ? html`<div class="subscription-error">${session.error}</div>` : html``}
      </div>
    `;
  }

  render(): TemplateResult {
    return html`
      <div class="subscription-tab-root">
        <p class="text-sm text-muted-foreground">
          Login subscription seperti di pi coding agent. Provider yang berhasil login akan muncul di pilihan model tanpa perlu API key.
        </p>

        ${this.error ? html`<div class="subscription-error">${this.error}</div>` : html``}
        ${this.renderSessionCard()}

        ${this.loading
          ? html`<div class="subscription-help">Memuat provider subscription…</div>`
          : html`
              <div class="subscription-provider-list">
                ${this.providers.map((provider) => {
                  return html`
                    <div class="subscription-card">
                      <div class="subscription-card-header">
                        <div>
                          <div class="subscription-card-title">${provider.name}</div>
                          <div class="subscription-card-subtitle">
                            ${provider.loggedIn ? "Logged in" : "Belum login"}
                          </div>
                        </div>

                        ${provider.loggedIn
                          ? html`
                              <button
                                class="subscription-secondary-button"
                                @click=${() => void this.logout(provider.id)}
                              >
                                Logout
                              </button>
                            `
                          : html`
                              <button
                                class="subscription-primary-button"
                                @click=${() => void this.login(provider.id)}
                              >
                                Login
                              </button>
                            `}
                      </div>
                    </div>
                  `;
                })}
              </div>
            `}
      </div>
    `;
  }
}
