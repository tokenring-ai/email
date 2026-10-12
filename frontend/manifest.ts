import type { ViewManifest } from "@tokenring-ai/one-frontend/dock/types.ts";
import type { PluginFrontendManifest } from "@tokenring-ai/one-frontend/plugins/types.ts";
import { Mail, MailOpen, PenSquare } from "lucide-react";

export const EMAIL_MESSAGES_VIEW = "email-messages";
export const EMAIL_MESSAGE_VIEW = "email-message";
export const EMAIL_COMPOSE_VIEW = "email-compose";
export const EMAIL_DASHBOARD_ID = "email";

/** Navigator: provider and mailbox pickers, search, the message list and (on the Email dashboard) agent sessions. */
export const emailMessagesViewManifest = {
  id: EMAIL_MESSAGES_VIEW,
  title: "Messages",
  description: "Browse and search the messages of an email provider",
  icon: Mail,
  availableOn: ["any"],
  defaultSize: { width: 300, height: 400 },
  minimumSize: { width: 240, height: 160 },
  tags: ["email"],
} satisfies ViewManifest;

/** One message per panel; without params it is the "Select a message" placeholder the navigator fills. */
export const emailMessageViewManifest = {
  id: EMAIL_MESSAGE_VIEW,
  title: "Message",
  description: "Read one email message",
  icon: MailOpen,
  availableOn: [],
  instanceable: true,
  minimumSize: { width: 360, height: 240 },
  tags: ["email"],
} satisfies ViewManifest;

/** The single compose panel; its draft survives closing the tab. */
export const emailComposeViewManifest = {
  id: EMAIL_COMPOSE_VIEW,
  title: "New message",
  description: "Write and send an email",
  icon: PenSquare,
  availableOn: [],
  minimumSize: { width: 360, height: 240 },
  tags: ["email"],
} satisfies ViewManifest;

/** Views that act as the Email dashboard's navigator; messages never tab into their group. */
export const EMAIL_SIDEBAR_VIEWS: readonly string[] = [EMAIL_MESSAGES_VIEW];

/**
 * Metadata for the email dashboard shipped by this plugin. The frontend merges
 * this into its registry and derives the SPA server routes from it.
 */
export default {
  id: EMAIL_DASHBOARD_ID,
  path: "/email",
  label: "Email",
  shortLabel: "EM",
  description: "Read, compose, and manage emails",
  group: "Data & tools",
  icon: Mail,
  iconClass: "text-red-500",
  gradient: "from-red-500 to-rose-600",
  views: [emailMessagesViewManifest, emailMessageViewManifest, emailComposeViewManifest],
} satisfies PluginFrontendManifest;
