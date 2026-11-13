import type { PluginLayoutManifest } from "@tokenring-ai/one-frontend/plugins/layoutTypes.ts";
import { Mail } from "lucide-react";
import {
  EMAIL_APP_ID,
  EMAIL_APP_PATH,
  EMAIL_COMPOSE_VIEW_ID,
  EMAIL_MESSAGE_VIEW_ID,
  EMAIL_MESSAGES_VIEW_ID,
  EMAIL_START_VIEW_ID,
  EMAIL_VIEW_KIND,
} from "./ids.ts";

/**
 * Email: the message navigator (with the attached email agent) on the left, one
 * tab per open message and the single compose tab on the right, and the agent's
 * chat beside them. Routes: `/email`, `/email/<provider>`,
 * `/email/<provider>/compose`, `/email/<provider>/<box>/<messageId>`.
 */
export const EMAIL_APP = {
  id: EMAIL_APP_ID,
  path: EMAIL_APP_PATH,
  label: "Email",
  shortLabel: "EM",
  description: "Read, compose, and manage emails",
  group: "Data & tools",
  icon: Mail,
  iconClass: "text-red-500",
  gradient: "from-red-500 to-rose-600",
  views: [EMAIL_MESSAGES_VIEW_ID, EMAIL_START_VIEW_ID, EMAIL_MESSAGE_VIEW_ID, EMAIL_COMPOSE_VIEW_ID, "chat"],
  primaryKind: EMAIL_VIEW_KIND,
  placement: { agent: "right" },
  layout: {
    split: "row",
    sizes: [1, 3],
    children: [
      { presenter: "single", accepts: ["navigator"], items: [EMAIL_MESSAGES_VIEW_ID] },
      { presenter: "tabs", accepts: [EMAIL_VIEW_KIND], items: [EMAIL_START_VIEW_ID], primary: true },
    ],
  },
} satisfies PluginLayoutManifest["apps"][number];

export default {
  apps: [EMAIL_APP],
  kinds: [{ id: EMAIL_VIEW_KIND, label: "Email", plural: "email tabs" }],
} satisfies PluginLayoutManifest;
