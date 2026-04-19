import type { Message } from "@mariozechner/pi-ai";
import { Alert } from "@mariozechner/mini-lit/dist/Alert.js";
import { defaultConvertToLlm, registerMessageRenderer } from "@mariozechner/pi-web-ui";
import type { AgentMessage, MessageRenderer } from "@mariozechner/pi-web-ui";
import { html } from "lit";

export interface SystemNotificationMessage {
  role: "system-notification";
  message: string;
  variant: "default" | "destructive";
  timestamp: string;
}

declare module "@mariozechner/pi-agent-core" {
  interface CustomAgentMessages {
    "system-notification": SystemNotificationMessage;
  }
}

const systemNotificationRenderer: MessageRenderer<SystemNotificationMessage> = {
  render: (notification) => {
    return html`
      <div class="px-4">
        ${Alert({
          variant: notification.variant,
          children: html`
            <div class="flex flex-col gap-1">
              <div>${notification.message}</div>
              <div class="text-xs opacity-70">
                ${new Date(notification.timestamp).toLocaleTimeString()}
              </div>
            </div>
          `,
        })}
      </div>
    `;
  },
};

export function registerCustomMessageRenderers() {
  registerMessageRenderer("system-notification", systemNotificationRenderer);
}

export function createSystemNotification(
  message: string,
  variant: "default" | "destructive" = "default",
): SystemNotificationMessage {
  return {
    role: "system-notification",
    message,
    variant,
    timestamp: new Date().toISOString(),
  };
}

export function customConvertToLlm(messages: AgentMessage[]): Message[] {
  const processed = messages.map((message): AgentMessage => {
    if (message.role === "system-notification") {
      const notification = message as SystemNotificationMessage;
      return {
        role: "user",
        content: `<system>${notification.message}</system>`,
        timestamp: Date.now(),
      };
    }
    return message;
  });

  return defaultConvertToLlm(processed);
}
