import { defineView } from "@tokenring-ai/one-frontend/layout/define.ts";
import type { PluginLayoutViews } from "@tokenring-ai/one-frontend/plugins/layoutTypes.ts";
import { Mail, MailOpen, PenSquare } from "lucide-react";
import { lazy } from "react";
import { EMAIL_COMPOSE_VIEW_ID, EMAIL_MESSAGE_VIEW_ID, EMAIL_MESSAGES_VIEW_ID, EMAIL_START_VIEW_ID, EMAIL_VIEW_KIND } from "./ids.ts";

const EmailNavigatorPane = lazy(() => import("./panes/EmailNavigatorPane.tsx"));
const EmailStartPane = lazy(() => import("./panes/EmailStartPane.tsx"));
const EmailMessagePane = lazy(() => import("./panes/EmailMessagePane.tsx"));
const EmailComposePane = lazy(() => import("./panes/EmailComposePane.tsx"));

export default {
  views: [
    // Navigator: provider and mailbox pickers, search, the message list and the attached agent's sessions.
    defineView({
      id: EMAIL_MESSAGES_VIEW_ID,
      kind: "navigator",
      title: "Messages",
      description: "Browse and search the messages of an email provider",
      icon: Mail,
      closable: false,
      component: EmailNavigatorPane,
    }),
    // `/email` and `/email/<provider>`: the "Select a message" placeholder; closes once a message is opened.
    defineView({
      id: EMAIL_START_VIEW_ID,
      landing: true,
      kind: EMAIL_VIEW_KIND,
      title: "Select a message",
      description: "Pick a message from the list to read it, or compose a new email",
      icon: Mail,
      route: ":provider?",
      instanceKey: () => "",
      component: EmailStartPane,
    }),
    // The single compose tab; its draft survives closing the tab. Two segments, so it never clashes with a message URL.
    defineView({
      id: EMAIL_COMPOSE_VIEW_ID,
      kind: EMAIL_VIEW_KIND,
      title: "New message",
      description: "Write and send an email",
      icon: PenSquare,
      route: ":provider/compose",
      instanceKey: () => "",
      component: EmailComposePane,
    }),
    // One message per tab. The same message may be listed under several boxes; one tab per message.
    defineView({
      id: EMAIL_MESSAGE_VIEW_ID,
      kind: EMAIL_VIEW_KIND,
      title: "Message",
      description: "Read one email message",
      icon: MailOpen,
      route: ":provider/:box/:messageId",
      instanceKey: params => `${params.provider ?? ""}\0${params.messageId ?? ""}`,
      component: EmailMessagePane,
    }),
  ],
} satisfies PluginLayoutViews;
