import type { EmailMessage, EmailProviderCapabilities } from "@tokenring-ai/email";
import DetailViewerArea from "@tokenring-ai/one-frontend/components/ui/DetailViewerArea.tsx";
import KeyValueMetadata from "@tokenring-ai/one-frontend/components/ui/KeyValueMetadata.tsx";
import TagChip from "@tokenring-ai/one-frontend/components/ui/TagChip.tsx";
import { sanitizeEmailHtml } from "@tokenring-ai/one-frontend/lib/sanitizeHtml.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@tokenring-ai/one-frontend/ui";
import { Archive, Bot, ChevronDown, Clock, FolderInput, Forward, Mail, MailOpen, MailWarning, PenSquare, Reply, ReplyAll, Star, Trash2 } from "lucide-react";
import { BOX_META, DEFAULT_BOX_META } from "../constants.ts";
import type { ComposeMode, EmailBoxRecord } from "../types.ts";
import { formatAddress, formatAddressList, messageTimestamp, senderName } from "../utils.ts";

const secondaryButtonClass =
  "flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Mailbox changes the reading pane offers. Each is shown only when the
 * provider supports it (see EmailProviderCapabilities).
 */
export interface MessageMailboxActions {
  capabilities: EmailProviderCapabilities;
  /** Mailboxes the message can be moved into (excludes its own and view-only boxes). */
  moveTargets: EmailBoxRecord[];
  onArchive: () => void;
  onToggleStar: () => void;
  onMove: (box: string) => void;
  onMarkUnread: () => void;
  /** Opens the saved draft in the compose panel (messages in the Drafts box). */
  onEditDraft?: () => void;
  /** A mailbox change is in flight, so the actions are disabled. */
  busy: boolean;
}

/**
 * Presentational reading pane. The panel that owns the message loads it (so it
 * can title its tab) and passes the request state in.
 */
export default function MessageViewer({
  message,
  loading,
  error,
  onRetry,
  onReply,
  onCompose,
  onDelete,
  deleting,
  onMarkRead,
  markingRead = false,
  mailboxActions,
}: {
  message: EmailMessage | null;
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  onReply: (cmd: string) => void;
  onCompose: (mode: Exclude<ComposeMode, "compose">, message: EmailMessage) => void;
  /** Deletes the message being read; the owning panel confirms and closes itself. */
  onDelete: () => void;
  /** A delete is in flight, so the action is disabled. */
  deleting: boolean;
  /** Marks an unread message as read; "mark unread" is a mailbox action, offered where the provider supports it. */
  onMarkRead?: () => void;
  markingRead?: boolean;
  mailboxActions?: MessageMailboxActions;
}) {
  return (
    <DetailViewerArea
      ready
      hasSelection
      data={message}
      loading={loading}
      {...(error != null ? { error } : !loading && !message ? { error: new Error("Could not load message.") } : {})}
      loadingMessage="Loading message…"
      errorTitle="Could not load message"
      onRetry={onRetry}
      emptyState={{
        icon: Mail,
        title: "No message",
        hint: "Select a message to view it.",
      }}
      renderContent={loaded => (
        <MessageContent
          key={loaded.id}
          message={loaded}
          onReply={onReply}
          onCompose={onCompose}
          onDelete={onDelete}
          deleting={deleting}
          {...(onMarkRead ? { onMarkRead } : {})}
          markingRead={markingRead}
          {...(mailboxActions ? { mailboxActions } : {})}
        />
      )}
    />
  );
}

function MessageContent({
  message: msg,
  onReply,
  onCompose,
  onDelete,
  deleting,
  onMarkRead,
  markingRead,
  mailboxActions,
}: {
  message: EmailMessage;
  onReply: (cmd: string) => void;
  onCompose: (mode: Exclude<ComposeMode, "compose">, message: EmailMessage) => void;
  onDelete: () => void;
  deleting: boolean;
  onMarkRead?: () => void;
  markingRead: boolean;
  mailboxActions?: MessageMailboxActions;
}) {
  const displayTimestamp = messageTimestamp(msg);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-primary space-y-3">
        <h2 className="text-base font-semibold text-primary leading-tight">{msg.subject || "(no subject)"}</h2>
        <KeyValueMetadata
          items={[
            { label: "From", value: formatAddress(msg.from), breakAll: true },
            msg.to.length > 0 && { label: "To", value: formatAddressList(msg.to) },
            msg.cc && msg.cc.length > 0 && { label: "Cc", value: formatAddressList(msg.cc) },
            {
              label: "Date",
              truncate: false,
              value: (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {displayTimestamp != null ? new Date(displayTimestamp).toLocaleString() : "—"}
                </span>
              ),
            },
          ]}
        />
        {msg.labels && msg.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.labels.map(l => (
              <TagChip key={l} label={l} showIcon={false} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCompose("reply", msg)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-all focus-ring cursor-pointer shadow-button-primary"
          >
            <Reply className="w-3.5 h-3.5" /> Reply
          </button>
          <button
            type="button"
            onClick={() => onCompose("replyAll", msg)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <ReplyAll className="w-3.5 h-3.5" /> Reply all
          </button>
          <button
            type="button"
            onClick={() => onCompose("forward", msg)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <Forward className="w-3.5 h-3.5" /> Forward
          </button>
          <button
            type="button"
            onClick={() => onReply(`Reply to the email from ${senderName(msg)} with subject "${msg.subject}"`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" /> Reply with AI
          </button>
          {onMarkRead && !msg.isRead && (
            <button
              type="button"
              onClick={onMarkRead}
              disabled={markingRead}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MailOpen className="w-3.5 h-3.5" /> {markingRead ? "Marking…" : "Mark as read"}
            </button>
          )}
          {mailboxActions && <MailboxActionButtons message={msg} actions={mailboxActions} />}
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-red-500 hover:border-red-500/40 hover:bg-hover transition-all focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" /> {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        {msg.htmlBody ? (
          <iframe
            srcDoc={sanitizeEmailHtml(msg.htmlBody)}
            className="w-full h-full min-h-[20rem] border-0 bg-white"
            // Emails are authored for a light canvas; keep the iframe out of the app color-scheme.
            style={{ colorScheme: "light" }}
            // Empty sandbox: no scripts, forms, popups, or same-origin parent access.
            sandbox=""
            title="Email content"
            referrerPolicy="no-referrer"
          />
        ) : msg.textBody ? (
          <pre className="text-xs text-zinc-900 whitespace-pre-wrap font-sans leading-relaxed p-5">{msg.textBody}</pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted">
            <Mail className="w-6 h-6 opacity-30" />
            <p className="text-sm">No body content.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MailboxActionButtons({ message, actions }: { message: EmailMessage; actions: MessageMailboxActions }) {
  const { capabilities, busy } = actions;
  const starred = message.isStarred === true;
  const inInbox = message.labels ? message.labels.includes("INBOX") : true;
  return (
    <>
      {actions.onEditDraft && (
        <button type="button" onClick={actions.onEditDraft} disabled={busy} className={secondaryButtonClass}>
          <PenSquare className="w-3.5 h-3.5" /> Edit draft
        </button>
      )}
      {capabilities.star && (
        <button
          type="button"
          onClick={actions.onToggleStar}
          disabled={busy}
          aria-pressed={starred}
          className={secondaryButtonClass}
          title={starred ? "Remove the star" : "Star this message"}
        >
          <Star className={starred ? "w-3.5 h-3.5 fill-amber-400 text-amber-400" : "w-3.5 h-3.5"} /> {starred ? "Starred" : "Star"}
        </button>
      )}
      {capabilities.markUnread && message.isRead && (
        <button type="button" onClick={actions.onMarkUnread} disabled={busy} className={secondaryButtonClass}>
          <MailWarning className="w-3.5 h-3.5" /> Mark unread
        </button>
      )}
      {capabilities.archive && inInbox && (
        <button type="button" onClick={actions.onArchive} disabled={busy} className={secondaryButtonClass} title="Remove from the inbox; it stays searchable">
          <Archive className="w-3.5 h-3.5" /> Archive
        </button>
      )}
      {capabilities.move && actions.moveTargets.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={busy}>
            <button type="button" disabled={busy} className={secondaryButtonClass}>
              <FolderInput className="w-3.5 h-3.5" /> Move to <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {actions.moveTargets.map(box => {
              const meta = BOX_META[box.id] ?? DEFAULT_BOX_META;
              const Icon = meta.icon;
              return (
                <DropdownMenuItem key={box.id} onSelect={() => actions.onMove(box.id)} className="gap-2 text-xs">
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} /> {box.name}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
