import { useDashboardApi } from "@tokenring-ai/one-frontend/dock/DashboardApiContext.tsx";
import { openInMainArea } from "@tokenring-ai/one-frontend/dock/layout/mainArea.ts";
import type { ViewParams } from "@tokenring-ai/one-frontend/dock/types.ts";
import { useAppAgentSession } from "@tokenring-ai/one-frontend/hooks/useAppAgentSession.tsx";
import type { ConfirmDialogOptions } from "@tokenring-ai/one-frontend/hooks/useConfirmDialog.tsx";
import { toastOnReject } from "@tokenring-ai/one-frontend/lib/toastOnReject.ts";
import { agentRPCClient, emailRPCClient, useEmailConfiguration } from "@tokenring-ai/one-frontend/rpc.ts";
import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ComposeDraft } from "../features/email/types.ts";
import { EMAIL_COMPOSE_VIEW, EMAIL_DASHBOARD_ID, EMAIL_MESSAGE_VIEW, EMAIL_SIDEBAR_VIEWS } from "../manifest.ts";
import { getComposeState, hasUnsavedChanges, isDraftDirty, startCompose } from "./emailStore.ts";
import { composePath, messagePath, providerPath } from "./paths.ts";

/**
 * Navigation between the Email views. Each action opens the target panel in
 * the main area right away (so a panel the user closed re-opens even when the
 * URL does not change) and then updates the URL. Off the Email dashboard it
 * only navigates, which lands the user on the dashboard.
 */
/** Asks before an unsent draft is replaced; `useConfirmDialog().openConfirm` fits. */
export type ConfirmReplaceDraft = (options: ConfirmDialogOptions) => Promise<boolean>;

/** The prompt shown before a reply, forward or new message replaces an unsent draft. */
export function replaceDraftConfirmOptions(currentProvider: string, nextProvider: string): ConfirmDialogOptions {
  return {
    id: "email-replace-draft",
    title: "Discard unsent draft?",
    message:
      currentProvider === nextProvider
        ? "You have an unsent message in the compose panel. Starting a new one discards it."
        : `You have an unsent message from ${currentProvider} in the compose panel. Starting one from ${nextProvider} discards it.`,
    confirmText: "Discard draft",
    cancelText: "Keep draft",
    variant: "warning",
  };
}

/** The prompt shown before Cancel / close throws away an unsent draft (or unsaved edits to a saved one). */
export function discardDraftConfirmOptions(savedBefore = false): ConfirmDialogOptions {
  return {
    id: "email-discard-draft",
    title: savedBefore ? "Discard unsaved changes?" : "Discard unsent draft?",
    message: savedBefore
      ? "Changes since you last saved this draft will be lost. The saved version stays in your Drafts box."
      : "This message has not been sent. Discarding it removes everything you have written.",
    confirmText: savedBefore ? "Discard changes" : "Discard draft",
    cancelText: "Keep draft",
    variant: "warning",
  };
}

/** Where Gmail, the email provider shipped today, is set up: a Google account with Gmail enabled. */
export const EMAIL_PROVIDER_CONFIG_HREF = `/configuration/${encodeURIComponent("@tokenring-ai/google")}`;

export function useEmailNavigation() {
  const navigate = useNavigate();
  const dashboard = useDashboardApi();
  const onDashboard = dashboard.dashboardId === EMAIL_DASHBOARD_ID;

  const go = useCallback(
    (viewId: string, params: ViewParams | undefined, path: string, options?: { replace?: boolean; fillPlaceholder?: boolean }) => {
      if (onDashboard) {
        openInMainArea(dashboard, viewId, params, {
          sidebarViews: EMAIL_SIDEBAR_VIEWS,
          ...(options?.fillPlaceholder ? { fillPlaceholder: true } : {}),
        });
      }
      void navigate(path, options?.replace ? { replace: true } : undefined);
    },
    [dashboard, navigate, onDashboard],
  );

  return {
    /** Switches the browsed provider without opening a message panel. */
    openProvider: useCallback(
      (provider: string | null, options?: { replace?: boolean }) => void navigate(providerPath(provider), options?.replace ? { replace: true } : undefined),
      [navigate],
    ),
    openMessage: useCallback(
      (provider: string, box: string, messageId: string) =>
        go(EMAIL_MESSAGE_VIEW, { provider, box, messageId }, messagePath(provider, box, messageId), { fillPlaceholder: true }),
      [go],
    ),
    /**
     * Opens the single compose panel, optionally seeded with a reply / forward
     * draft. An unsent draft is never silently replaced: "Compose" for the same
     * provider (or reopening the same saved draft) resumes it; anything else asks
     * through `confirmReplace` unless the draft is saved, unchanged, at the
     * provider (and keeps the draft when there is no way to ask). Resolves
     * whether the panel opened.
     */
    openCompose: useCallback(
      async (provider: string, draft?: ComposeDraft, confirmReplace?: ConfirmReplaceDraft): Promise<boolean> => {
        const current = getComposeState();
        if (current && isDraftDirty(current.draft)) {
          const sameSavedDraft = draft?.serverDraftId !== undefined && draft.serverDraftId === current.draft.serverDraftId;
          if ((!draft || sameSavedDraft) && current.provider === provider) {
            go(EMAIL_COMPOSE_VIEW, undefined, composePath(provider));
            return true;
          }
          // A draft already saved, unchanged, to the provider is safe to replace.
          if (hasUnsavedChanges(current)) {
            const confirmed = confirmReplace ? await confirmReplace(replaceDraftConfirmOptions(current.provider, provider)) : false;
            if (!confirmed) return false;
          }
        }
        startCompose(provider, draft);
        go(EMAIL_COMPOSE_VIEW, undefined, composePath(provider));
        return true;
      },
      [go],
    ),
    /** Opens (or focuses) the chat panel for an agent without leaving the dashboard. */
    openAgentChat: useCallback(
      (agentId: string) => {
        if (onDashboard) dashboard.openView("chat", { agentId }, { position: "right" });
        else void navigate(`/agent/${agentId}`);
      },
      [dashboard, navigate, onDashboard],
    ),
  };
}

/**
 * The Email dashboard's agent session. Every view shares one selection: the
 * hook persists it under `agentSession:email`, and instances stay in sync
 * within the document.
 */
export function useEmailAgentSession() {
  const configuration = useEmailConfiguration();
  const agentTypes = configuration.data?.agentTypes ?? ["email"];
  const session = useAppAgentSession({ appName: "Email dashboard", storageKey: "email", agentTypes });
  const { agentId, createAgent } = session;

  /** The attached agent, creating one on demand (compose and "Reply with AI" need one). */
  const ensureAgent = useCallback(async (): Promise<string | null> => agentId ?? (await createAgent()), [agentId, createAgent]);

  return { ...session, ensureAgent };
}

/** Tells the attached agent which provider (and message) the user is looking at. */
export function useSyncEmailState(agentId: string | null, provider: string | null, messageId?: string | null): void {
  useEffect(() => {
    if (!agentId || !provider) return;
    toastOnReject(
      emailRPCClient.updateEmailState({
        agentId,
        selectedProvider: provider,
        ...(messageId !== undefined ? { selectedMessageId: messageId } : {}),
      }),
    );
  }, [agentId, provider, messageId]);
}

/** Hands a message to the attached agent, creating one if needed. */
export async function sendToAgent(ensureAgent: () => Promise<string | null>, message: string): Promise<void> {
  const id = await ensureAgent();
  // ensureAgent already toasts on create failure
  if (!id) return;
  toastOnReject(agentRPCClient.sendInput({ agentId: id, input: { from: "Email App", message } }), {
    message: err => `Failed to send to agent: ${formatError(err)}`,
  });
}
