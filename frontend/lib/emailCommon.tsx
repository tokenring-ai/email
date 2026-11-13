import { useAppAgentSession } from "@tokenring-ai/one-frontend/hooks/useAppAgentSession.tsx";
import type { ConfirmDialogOptions } from "@tokenring-ai/one-frontend/hooks/useConfirmDialog.tsx";
import { toastOnReject } from "@tokenring-ai/one-frontend/lib/toastOnReject.ts";
import { agentRPCClient, emailRPCClient, useEmailConfiguration } from "@tokenring-ai/one-frontend/rpc.ts";
import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useEffect } from "react";

/** Dock-free pieces shared by the Email views: draft prompts, provider setup link, agent session and hand-offs. */

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
