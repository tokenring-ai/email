import FormActionBar from "@tokenring-ai/one-frontend/components/ui/FormActionBar.tsx";
import { KeyValueRow } from "@tokenring-ai/one-frontend/components/ui/KeyValueMetadata.tsx";
import { toastManager } from "@tokenring-ai/one-frontend/components/ui/toast.tsx";
import { cn } from "@tokenring-ai/one-frontend/lib/utils.ts";
import { emailRPCClient } from "@tokenring-ai/one-frontend/rpc.ts";
import { Button } from "@tokenring-ai/one-frontend/ui";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Save, Send, X } from "lucide-react";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import type { ComposeDraft } from "../types.ts";
import { isValidEmailList, parseEmailAddresses } from "../utils.ts";

const inputClass =
  "w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all";

const MODE_LABELS: Record<ComposeDraft["mode"], string> = {
  compose: "New message",
  reply: "Reply",
  replyAll: "Reply all",
  forward: "Forward",
};

/**
 * Controlled compose form. The draft lives outside the component (a module
 * store), so closing the panel mid-message keeps every field.
 */
export default function ComposeForm({
  provider,
  draft,
  session,
  ensureAgent,
  onChange,
  onClose,
  onSaved,
  onSent,
  unsavedEdits = true,
}: {
  provider: string;
  draft: ComposeDraft;
  /** Bumped when a new draft replaces the current one, so focus moves again. */
  session: number;
  ensureAgent: () => string | Promise<string | null>;
  onChange: (patch: Partial<ComposeDraft>) => void;
  onClose: () => void;
  /** The draft was saved to the provider's Drafts box as `serverDraftId`. */
  onSaved?: (serverDraftId: string) => void;
  onSent: () => void;
  /** The form differs from what was last saved to the provider. */
  unsavedEdits?: boolean;
}) {
  const [showCcBcc, setShowCcBcc] = useState(Boolean(draft.cc || draft.bcc));
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mode = draft.mode;

  // A new draft (Compose while already composing, reply from another panel) re-aims focus.
  useEffect(() => {
    setSending(false);
    requestAnimationFrame(() => {
      // The user may already be typing by the time this runs; never steal focus back.
      const active = document.activeElement;
      if (active && active !== document.body && formRef.current?.contains(active)) return;
      if (mode === "reply" || mode === "replyAll") {
        bodyRef.current?.focus();
        // Place caret at start so user types above the quote
        bodyRef.current?.setSelectionRange(0, 0);
      } else {
        toRef.current?.focus();
      }
    });
  }, [session, mode]);

  /** The draft as provider draft fields (shared by Save draft and sending a saved draft). */
  const draftFields = () => {
    const ccAddrs = parseEmailAddresses(draft.cc);
    const bccAddrs = parseEmailAddresses(draft.bcc);
    return {
      subject: draft.subject.trim() || "(no subject)",
      to: parseEmailAddresses(draft.to),
      ...(ccAddrs.length > 0 && { cc: ccAddrs }),
      ...(bccAddrs.length > 0 && { bcc: bccAddrs }),
      textBody: draft.body,
      ...(draft.relatedThreadId && { threadId: draft.relatedThreadId }),
    };
  };

  /** Saves to the provider's Drafts box, updating the saved draft in place when there is one. */
  const saveToProvider = async () => {
    const saved = await emailRPCClient.saveDraft({
      provider,
      ...(draft.serverDraftId && { id: draft.serverDraftId }),
      ...draftFields(),
    });
    onSaved?.(saved.draft.id);
    return saved.draft;
  };

  const handleSaveDraft = async () => {
    // Drafts may be incomplete, but addresses that are present must parse.
    for (const [label, value] of [
      ["To", draft.to],
      ["Cc", draft.cc],
      ["Bcc", draft.bcc],
    ] as const) {
      if (value.trim() && !isValidEmailList(value)) {
        toastManager.error(`${label} contains an invalid address`, { duration: 3500 });
        return;
      }
    }
    setSaving(true);
    try {
      await saveToProvider();
      toastManager.success("Draft saved", { duration: 2500 });
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!isValidEmailList(draft.to)) {
      toastManager.error("Enter at least one valid recipient in To", { duration: 3500 });
      return;
    }
    if (draft.cc.trim() && !isValidEmailList(draft.cc)) {
      toastManager.error("Cc contains an invalid address", { duration: 3500 });
      return;
    }
    if (draft.bcc.trim() && !isValidEmailList(draft.bcc)) {
      toastManager.error("Bcc contains an invalid address", { duration: 3500 });
      return;
    }

    setSending(true);
    try {
      // A draft saved to the provider is updated with the latest edits and sent
      // in place, so it does not linger in the Drafts box.
      if (draft.serverDraftId) {
        const saved = await saveToProvider();
        const sent = await emailRPCClient.sendDraft({ provider, id: saved.id });
        toastManager.success(sent.message || "Email sent", { duration: 2500 });
        onSent();
        return;
      }

      const agentId = await ensureAgent();
      // ensureAgent already toasts on create failure
      if (!agentId) return;

      await emailRPCClient.updateEmailState({ agentId, selectedProvider: provider });

      const toAddrs = parseEmailAddresses(draft.to);
      const ccAddrs = parseEmailAddresses(draft.cc);
      const bccAddrs = parseEmailAddresses(draft.bcc);

      const created = await emailRPCClient.createDraft({
        agentId,
        subject: draft.subject.trim() || "(no subject)",
        to: toAddrs,
        ...(ccAddrs.length > 0 && { cc: ccAddrs }),
        ...(bccAddrs.length > 0 && { bcc: bccAddrs }),
        textBody: draft.body,
      });

      if (created.status === "agentNotFound") {
        toastManager.error("Email agent is no longer available. Try again.", { duration: 4000 });
        return;
      }

      // createDraft RPC omits threadId; attach it via update so replies stay in-thread
      if (draft.relatedThreadId) {
        const updated = await emailRPCClient.updateDraft({
          agentId,
          updatedData: { threadId: draft.relatedThreadId },
        });
        if (updated.status === "agentNotFound") {
          toastManager.error("Email agent is no longer available. Try again.", { duration: 4000 });
          return;
        }
      }

      const sent = await emailRPCClient.sendCurrentDraft({ agentId });
      if (sent.status === "agentNotFound") {
        toastManager.error("Email agent is no longer available. Try again.", { duration: 4000 });
        return;
      }

      toastManager.success(sent.message || "Email sent", { duration: 2500 });
      onSent();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSending(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={e => void handleSubmit(e)} className="h-full flex flex-col overflow-hidden bg-primary">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-primary bg-secondary">
        <h2 className="text-sm font-semibold text-primary">{MODE_LABELS[mode]}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring cursor-pointer"
          aria-label="Close compose"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        <KeyValueRow
          as="label"
          label="To"
          labelWidth="w-10"
          align="center"
          truncate={false}
          labelClassName="text-xs text-muted"
          valueClassName="text-inherit"
          value={
            <input
              ref={toRef}
              type="text"
              value={draft.to}
              onChange={e => onChange({ to: e.target.value })}
              placeholder="recipient@example.com"
              className={inputClass}
              required
              autoComplete="off"
            />
          }
        />

        {!showCcBcc ? (
          <button type="button" onClick={() => setShowCcBcc(true)} className="text-xs text-muted hover:text-primary transition-colors cursor-pointer ml-12">
            Add Cc / Bcc
          </button>
        ) : (
          <>
            <KeyValueRow
              as="label"
              label="Cc"
              labelWidth="w-10"
              align="center"
              truncate={false}
              labelClassName="text-xs text-muted"
              valueClassName="text-inherit"
              value={
                <input
                  type="text"
                  value={draft.cc}
                  onChange={e => onChange({ cc: e.target.value })}
                  placeholder="optional"
                  className={inputClass}
                  autoComplete="off"
                />
              }
            />
            <KeyValueRow
              as="label"
              label="Bcc"
              labelWidth="w-10"
              align="center"
              truncate={false}
              labelClassName="text-xs text-muted"
              valueClassName="text-inherit"
              value={
                <input
                  type="text"
                  value={draft.bcc}
                  onChange={e => onChange({ bcc: e.target.value })}
                  placeholder="optional"
                  className={inputClass}
                  autoComplete="off"
                />
              }
            />
          </>
        )}

        <KeyValueRow
          as="label"
          label="Subject"
          labelWidth="w-10"
          align="center"
          truncate={false}
          labelClassName="text-xs text-muted"
          valueClassName="text-inherit"
          value={
            <input
              type="text"
              value={draft.subject}
              onChange={e => onChange({ subject: e.target.value })}
              placeholder="Subject"
              className={inputClass}
              autoComplete="off"
            />
          }
        />

        <textarea
          ref={bodyRef}
          value={draft.body}
          onChange={e => onChange({ body: e.target.value })}
          placeholder="Write your message…"
          aria-label="Message body"
          rows={12}
          className={cn(inputClass, "resize-y min-h-[12rem] font-sans leading-relaxed")}
        />
      </div>

      <FormActionBar
        onCancel={onClose}
        submitLabel="Send"
        submitIcon={Send}
        loading={sending}
        disabled={saving}
        separated
        size="md"
        status={draft.serverDraftId ? <span className="text-xs text-muted">{unsavedEdits ? "Unsaved changes" : "Saved in Drafts"}</span> : undefined}
        actions={
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={Save}
            busy={saving}
            busyLabel="Saving…"
            disabled={sending}
            onClick={() => void handleSaveDraft()}
          >
            Save draft
          </Button>
        }
      />
    </form>
  );
}
