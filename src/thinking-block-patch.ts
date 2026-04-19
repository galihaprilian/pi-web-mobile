import { icon } from "@mariozechner/mini-lit";
import { html } from "lit";
import { ChevronRight } from "lucide";

const PATCH_FLAG = "__piwebThinkingBlockPatched";

type ThinkingBlockElement = HTMLElement & {
  content: string;
  isStreaming: boolean;
  isExpanded: boolean;
  toggleExpanded: () => void;
  requestUpdate?: () => void;
  updated?: (changedProperties: Map<string, unknown>) => void;
  render: () => unknown;
};

void customElements.whenDefined("thinking-block").then(() => {
  const ThinkingBlockCtor = customElements.get("thinking-block") as any;
  if (!ThinkingBlockCtor || ThinkingBlockCtor[PATCH_FLAG]) return;

  const originalUpdated = ThinkingBlockCtor.prototype.updated;

  ThinkingBlockCtor.prototype.updated = function (this: ThinkingBlockElement, changedProperties: Map<string, unknown>) {
    originalUpdated?.call(this, changedProperties);
    if (changedProperties.has("isStreaming") && this.isStreaming) {
      this.isExpanded = true;
    }
  };

  ThinkingBlockCtor.prototype.render = function (this: ThinkingBlockElement) {
    const shimmerClasses = this.isStreaming
      ? "animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent"
      : "";
    const label = this.isStreaming ? "Working..." : "Thinking";
    const status = this.isStreaming ? "Streaming reasoning" : "Tap to expand";

    return html`
      <div class="thinking-block ${this.isStreaming ? "is-streaming" : "is-idle"}">
        <div
          class="thinking-header cursor-pointer select-none flex items-center justify-between gap-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          @click=${() => this.toggleExpanded()}
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="transition-transform inline-block shrink-0 ${this.isExpanded ? "rotate-90" : ""}">
              ${icon(ChevronRight, "sm")}
            </span>
            <div class="thinking-header-copy min-w-0">
              <div class="thinking-header-title ${shimmerClasses}">${label}</div>
              <div class="thinking-header-status">${status}</div>
            </div>
          </div>
          ${this.isStreaming ? html`<span class="thinking-spinner" aria-hidden="true"></span>` : html``}
        </div>
        ${this.isExpanded ? html`<markdown-block .content=${this.content} .isThinking=${true}></markdown-block>` : ""}
      </div>
    `;
  };

  ThinkingBlockCtor[PATCH_FLAG] = true;
});
