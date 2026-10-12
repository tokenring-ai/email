import type { EmailAddress, EmailDraft, EmailMessage } from "@tokenring-ai/email";

export type EmailBoxRecord = { id: string; name: string };
export type MessageFilter = "all" | "read" | "unread";

export type ComposeMode = "compose" | "reply" | "replyAll" | "forward";

export type ComposeDraft = {
  mode: ComposeMode;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  /** Message being replied to / forwarded, if any */
  relatedMessageId?: string;
  relatedThreadId?: string;
  /** Provider draft this compose saves into and sends; set by "Save draft" or when resuming from the Drafts box. */
  serverDraftId?: string;
};

export type { EmailAddress, EmailDraft, EmailMessage };
