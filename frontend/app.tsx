import { openInMainArea } from "@tokenring-ai/one-frontend/dock/layout/mainArea.ts";
import type { PluginFrontendContribution } from "@tokenring-ai/one-frontend/plugins/types.ts";
import { lazy } from "react";
import { z } from "zod";
import { getComposeState } from "./lib/emailStore.ts";
import { COMPOSE_SEGMENT, composePath, isComposePath, messagePath, providerPath } from "./lib/paths.ts";
import manifest, {
  EMAIL_COMPOSE_VIEW,
  EMAIL_MESSAGE_VIEW,
  EMAIL_SIDEBAR_VIEWS,
  emailComposeViewManifest,
  emailMessagesViewManifest,
  emailMessageViewManifest,
} from "./manifest.ts";

/** All optional: a parameter-less panel is the "Select a message" placeholder that the next opened message fills. */
export const EmailMessageParams = z.object({
  provider: z.string().min(1).optional(),
  box: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
});
export type EmailMessageParams = z.infer<typeof EmailMessageParams>;

/**
 * The Email dashboard: a message navigator beside one panel per open message
 * and a single compose panel. Routes: `/email`, `/email/<provider>`,
 * `/email/<provider>/compose`, `/email/<provider>/<box>/<messageId>`.
 * Discovered by `frontend/src/plugins/registry.ts`.
 */
export default {
  ...manifest,
  views: [
    { ...emailMessagesViewManifest, component: lazy(() => import("./views/EmailMessagesView.tsx")) },
    {
      ...emailMessageViewManifest,
      params: EmailMessageParams,
      // The same message may be listed under several boxes; one panel per message.
      instanceKey: params => (params.provider && params.messageId ? `${params.provider}\0${params.messageId}` : "new"),
      titleFor: () => "Message",
      component: lazy(() => import("./views/EmailMessageView.tsx")),
    },
    { ...emailComposeViewManifest, component: lazy(() => import("./views/EmailComposeView.tsx")) },
  ],
  dashboards: [
    {
      ...manifest,
      routePath: "/email/:provider?",
      // The static compose segment first so it is never read as a box name.
      extraRoutePaths: [`/email/:provider/${COMPOSE_SEGMENT}`, "/email/:provider/:box/:messageId"],
      defaultLayout: {
        kind: "row",
        sizes: [1, 3],
        children: [
          { kind: "panel", view: emailMessagesViewManifest.id },
          { kind: "panel", view: emailMessageViewManifest.id },
        ],
      },
      onNavigate({ params, pathname }, api) {
        if (!params.provider) return;
        if (isComposePath(pathname)) {
          openInMainArea(api, EMAIL_COMPOSE_VIEW, undefined, { sidebarViews: EMAIL_SIDEBAR_VIEWS });
          return;
        }
        if (params.box && params.messageId) {
          openInMainArea(
            api,
            EMAIL_MESSAGE_VIEW,
            { provider: params.provider, box: params.box, messageId: params.messageId },
            { sidebarViews: EMAIL_SIDEBAR_VIEWS, fillPlaceholder: true },
          );
        }
      },
      pathForActivePanel(panel, match) {
        switch (panel?.viewId) {
          case EMAIL_MESSAGE_VIEW: {
            const { provider, box, messageId } = panel.params;
            if (typeof provider === "string" && typeof box === "string" && typeof messageId === "string") return messagePath(provider, box, messageId);
            // The placeholder keeps the provider the user is browsing.
            return providerPath(match.params.provider ?? null);
          }
          case EMAIL_COMPOSE_VIEW: {
            const provider = getComposeState()?.provider ?? match.params.provider;
            return provider ? composePath(provider) : null;
          }
          default:
            return null;
        }
      },
      documentTitle: ({ params, pathname }) => {
        if (!params.provider) return "Email";
        if (isComposePath(pathname)) return `New message · ${params.provider} · Email`;
        return `${params.provider} · Email`;
      },
    },
  ],
} satisfies PluginFrontendContribution;
