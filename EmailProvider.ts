import { z } from "zod";

// Zod schemas
export const EmailAddressSchema = z.object({
  email: z.string(),
  name: z.string().exactOptional(),
});

export const EmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().exactOptional(),
  subject: z.string(),
  from: EmailAddressSchema,
  to: z.array(EmailAddressSchema),
  cc: z.array(EmailAddressSchema).exactOptional(),
  bcc: z.array(EmailAddressSchema).exactOptional(),
  snippet: z.string().exactOptional(),
  textBody: z.string().exactOptional(),
  htmlBody: z.string().exactOptional(),
  labels: z.array(z.string()).exactOptional(),
  isRead: z.boolean(),
  /** Set by providers that support starring (see EmailProvider.setStarred). */
  isStarred: z.boolean().exactOptional(),
  receivedAt: z.number().exactOptional(),
  sentAt: z.number().exactOptional(),
});

export const EmailDraftSchema = z.object({
  id: z.string(),
  threadId: z.string().exactOptional(),
  subject: z.string(),
  to: z.array(EmailAddressSchema),
  cc: z.array(EmailAddressSchema).exactOptional(),
  bcc: z.array(EmailAddressSchema).exactOptional(),
  textBody: z.string().exactOptional(),
  htmlBody: z.string().exactOptional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const EmailBoxSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const EmailMessageQueryOptionsSchema = z.object({
  box: z.string().exactOptional(),
  limit: z.number().exactOptional(),
  unreadOnly: z.boolean().exactOptional(),
  pageToken: z.string().exactOptional(),
});

export const EmailMessagePageSchema = z.object({
  messages: z.array(EmailMessageSchema),
  nextPageToken: z.string().exactOptional(),
});

export const EmailSearchOptionsSchema = z.object({
  query: z.string(),
  box: z.string().exactOptional(),
  limit: z.number().exactOptional(),
  unreadOnly: z.boolean().exactOptional(),
  pageToken: z.string().exactOptional(),
});

// Type inference from schemas
export type EmailAddress = z.infer<typeof EmailAddressSchema>;
export type EmailBox = z.infer<typeof EmailBoxSchema>;
export type EmailMessage = z.infer<typeof EmailMessageSchema>;
export type EmailMessagePage = z.infer<typeof EmailMessagePageSchema>;
export type EmailDraft = z.infer<typeof EmailDraftSchema>;
export type EmailMessageQueryOptions = z.infer<typeof EmailMessageQueryOptionsSchema>;
export type EmailSearchOptions = z.infer<typeof EmailSearchOptionsSchema>;

// Derived types
export type DraftEmailData = Omit<EmailDraft, "id" | "createdAt" | "updatedAt">;
export type UpdateDraftEmailData = Partial<Omit<EmailDraft, "id" | "createdAt" | "updatedAt">>;

/** Which optional EmailProvider operations a provider implements. */
export const EmailProviderCapabilitiesSchema = z.object({
  markUnread: z.boolean(),
  archive: z.boolean(),
  star: z.boolean(),
  move: z.boolean(),
  resumeDrafts: z.boolean(),
});
export type EmailProviderCapabilities = z.infer<typeof EmailProviderCapabilitiesSchema>;

export function getEmailProviderCapabilities(provider: EmailProvider): EmailProviderCapabilities {
  return {
    markUnread: typeof provider.markAsUnread === "function",
    archive: typeof provider.archiveMessage === "function",
    star: typeof provider.setStarred === "function",
    move: typeof provider.moveMessage === "function",
    resumeDrafts: typeof provider.getDraftByMessageId === "function",
  };
}

export interface EmailProvider {
  description: string;

  listBoxes(): Promise<EmailBox[]>;

  getMessages(filter: EmailMessageQueryOptions): Promise<EmailMessagePage>;

  searchMessages(filter: EmailSearchOptions): Promise<EmailMessage[]>;

  /**
   * Paged search. Optional: providers that cannot page a search leave it out,
   * and callers fall back to `searchMessages` (a single, first page).
   */
  searchMessagePage?(filter: EmailSearchOptions): Promise<EmailMessagePage>;

  getMessageById(id: string): Promise<EmailMessage>;

  createDraft(data: DraftEmailData): Promise<EmailDraft>;

  /** Replaces the saved draft `data.id` with `data`. */
  updateDraft(data: EmailDraft): Promise<EmailDraft>;

  sendDraft(id: string): Promise<void>;

  markAsRead(id: string): Promise<void>;

  /** Marks a message unread again. Optional: providers that cannot leave it out. */
  markAsUnread?(id: string): Promise<void>;

  /**
   * Archives a message: it leaves the inbox but stays searchable (Gmail
   * removes the INBOX label). Optional.
   */
  archiveMessage?(id: string): Promise<void>;

  /** Stars or un-stars a message. Optional. */
  setStarred?(id: string, starred: boolean): Promise<void>;

  /**
   * Moves a message to another mailbox (a box id from `listBoxes`, such as
   * "inbox", "spam" or "trash"). Optional.
   */
  moveMessage?(id: string, box: string): Promise<void>;

  /**
   * Loads the saved draft behind a message listed in the Drafts box, so it can
   * be resumed and updated in place. Resolves undefined when the message is not
   * a draft. Optional.
   */
  getDraftByMessageId?(messageId: string): Promise<EmailDraft | undefined>;

  /**
   * Removes a message from the user's mailbox.
   *
   * Implementations should prefer recoverable semantics: where the backend has
   * a trash / bin folder the message must be moved there rather than destroyed,
   * so the user can restore it. Only providers with no such concept may delete
   * permanently.
   */
  deleteMessage(id: string): Promise<void>;
}
