import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import { toastManager } from "@tokenring-ai/one-frontend/components/ui/toast.tsx";
import ViewHeader from "@tokenring-ai/one-frontend/components/ui/ViewHeader.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import type { ViewProps } from "@tokenring-ai/one-frontend/dock/types.ts";
import { useBusyAction } from "@tokenring-ai/one-frontend/hooks/useBusyAction.ts";
import { useConfirmDialog } from "@tokenring-ai/one-frontend/hooks/useConfirmDialog.tsx";
import { emailRPCClient, useEmailBoxes, useEmailMessage } from "@tokenring-ai/one-frontend/rpc.ts";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Mail, X } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import type { EmailMessageParams } from "../app.tsx";
import MessageViewer, { type MessageMailboxActions } from "../features/email/components/MessageViewer.tsx";
import type { ComposeMode } from "../features/email/types.ts";
import { composeDraftFromSaved, draftFromMessage } from "../features/email/utils.ts";
import { type EmailMessageAction, modifyEmailMessages, moveTargets, useEmailCapabilities } from "../lib/emailQueries.ts";
import { sendToAgent, useEmailAgentSession, useEmailNavigation, useSyncEmailState } from "../lib/emailShared.tsx";
import { bumpEmailListRefresh } from "../lib/emailStore.ts";

/** When the provider key is an email address, use it to exclude self from reply-all. */
function currentEmailFromProvider(provider: string): string | undefined {
  return provider.includes("@") ? provider : undefined;
}

/**
 * One message per panel. Opened without params it is the placeholder the
 * navigator fills when the user picks a message.
 */
export default function EmailMessageView({ params, panel }: ViewProps<EmailMessageParams>) {
  const { provider, box, messageId } = params;
  const { openCompose } = useEmailNavigation();
  const { agentId, ensureAgent } = useEmailAgentSession();
  useSyncEmailState(agentId, provider ?? null, messageId ?? null);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const { busy: deleting, execute: executeDelete } = useBusyAction();
  const { busy: markingRead, execute: executeMarkRead } = useBusyAction();
  const { busy: changingMailbox, execute: executeMailboxChange } = useBusyAction();
  const capabilities = useEmailCapabilities(provider);
  const boxesQuery = useEmailBoxes(provider);

  const { data, isLoading, error, mutate } = useEmailMessage(provider, messageId);
  const message = data?.email ?? null;

  // The tab shows the subject once the message arrives.
  useEffect(() => {
    if (!messageId) {
      panel.setTitle("Message");
      return;
    }
    panel.setTitle(message ? message.subject || "(no subject)" : "Message");
  }, [message, messageId, panel]);

  /**
   * Deletes through the agent's active provider (Gmail and friends move the
   * message to trash), then drops the panel and refreshes the navigator list.
   */
  const handleDelete = useCallback(async () => {
    if (!provider || !messageId) return;
    const confirmed = await openConfirm({
      title: "Delete email",
      message: "Move this message to the trash? You can restore it from your mail provider's trash.",
      confirmText: "Delete",
      cancelText: "Keep",
      variant: "danger",
    });
    if (!confirmed) return;

    await executeDelete(async () => {
      try {
        const agent = await ensureAgent();
        // ensureAgent already toasts on create failure
        if (!agent) return;
        // A freshly created agent has not been synced by the effect above yet,
        // and deleting goes through the agent's active provider.
        await emailRPCClient.updateEmailState({ agentId: agent, selectedProvider: provider });
        const result = await emailRPCClient.deleteMessage({ agentId: agent, id: messageId });
        if (result.status !== "success") {
          toastManager.error("Could not delete the message: the email agent is gone.", { duration: 5000 });
          return;
        }
        toastManager.success(result.message, { duration: 2500 });
        bumpEmailListRefresh();
        panel.close();
      } catch (err) {
        toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
      }
    });
  }, [ensureAgent, executeDelete, messageId, openConfirm, panel, provider]);

  const handleMarkRead = useCallback(async () => {
    if (!provider || !messageId) return;
    await executeMarkRead(async () => {
      try {
        await emailRPCClient.markMessageAsRead({ provider, id: messageId });
        await mutate();
        bumpEmailListRefresh();
      } catch (err) {
        toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
      }
    });
  }, [executeMarkRead, messageId, mutate, provider]);

  /**
   * Applies a mailbox change to this message. Changes that take it out of the
   * mailbox being browsed (archive, move) close the panel; flag changes reload it.
   */
  const applyMailboxAction = useCallback(
    async (action: EmailMessageAction, { closesPanel }: { closesPanel: boolean }) => {
      if (!provider || !messageId) return;
      await executeMailboxChange(async () => {
        try {
          const result = await modifyEmailMessages(provider, [messageId], action);
          const failure = result.failed[0];
          if (failure) {
            toastManager.error(failure.error, { duration: 5000 });
            return;
          }
          toastManager.success(result.message, { duration: 2500 });
          bumpEmailListRefresh();
          if (closesPanel) panel.close();
          else await mutate();
        } catch (err) {
          toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
        }
      });
    },
    [executeMailboxChange, messageId, mutate, panel, provider],
  );

  /** Resumes a Drafts-box message in the compose panel as the saved draft it is. */
  const handleEditDraft = useCallback(async () => {
    if (!provider || !messageId) return;
    await executeMailboxChange(async () => {
      try {
        const result = await emailRPCClient.getDraftForMessage({ provider, messageId });
        if (!result.draft) {
          toastManager.error(result.message, { duration: 4000 });
          return;
        }
        await openCompose(provider, composeDraftFromSaved(result.draft), openConfirm);
      } catch (err) {
        toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
      }
    });
  }, [executeMailboxChange, messageId, openCompose, openConfirm, provider]);

  const boxes = boxesQuery.data?.boxes;
  const mailboxActions = useMemo((): MessageMailboxActions | undefined => {
    if (!capabilities) return undefined;
    const starred = message?.isStarred === true;
    return {
      capabilities,
      moveTargets: moveTargets(boxes ?? [], box),
      busy: changingMailbox,
      onArchive: () => void applyMailboxAction({ type: "archive" }, { closesPanel: true }),
      onToggleStar: () => void applyMailboxAction({ type: "star", starred: !starred }, { closesPanel: false }),
      onMarkUnread: () => void applyMailboxAction({ type: "markUnread" }, { closesPanel: false }),
      onMove: target => void applyMailboxAction({ type: "move", box: target }, { closesPanel: true }),
      ...(box === "drafts" && capabilities.resumeDrafts ? { onEditDraft: () => void handleEditDraft() } : {}),
    };
  }, [applyMailboxAction, box, boxes, capabilities, changingMailbox, handleEditDraft, message?.isStarred]);

  if (!provider || !messageId) {
    return (
      <EmptyState
        icon={Mail}
        iconBadgeClassName="bg-linear-to-br from-red-500 to-rose-600"
        title="Select a message"
        hint="Pick a message from the list to read it here, or compose a new email."
        variant="page"
      />
    );
  }

  const startCompose = (mode: Exclude<ComposeMode, "compose">, loaded: Parameters<typeof draftFromMessage>[0]) => {
    const currentEmail = currentEmailFromProvider(provider);
    // Asks before replacing an unsent draft in the compose panel.
    void openCompose(provider, draftFromMessage(loaded, mode, currentEmail != null ? { currentEmail } : {}), openConfirm);
  };

  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader
          variant="navigator"
          title={
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="flex-1 min-w-0 text-xs text-muted truncate">{box ? `${provider} · ${box}` : provider}</span>
              <button
                type="button"
                onClick={() => panel.close()}
                className="p-1 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring cursor-pointer shrink-0"
                aria-label="Close email"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          }
        />
      }
    >
      <div className="flex-1 min-h-0">
        <MessageViewer
          message={message}
          loading={isLoading}
          {...(error != null ? { error } : {})}
          onRetry={() => void mutate()}
          onReply={command => void sendToAgent(ensureAgent, command)}
          onCompose={startCompose}
          onDelete={() => void handleDelete()}
          deleting={deleting}
          onMarkRead={() => void handleMarkRead()}
          markingRead={markingRead}
          {...(mailboxActions ? { mailboxActions } : {})}
        />
      </div>
      <ConfirmDialog />
    </ViewShell>
  );
}
