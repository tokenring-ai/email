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
  receivedAt: z.date(),
  sentAt: z.date().exactOptional(),
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
  createdAt: z.date(),
  updatedAt: z.date(),
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

export interface EmailProvider {
  description: string;

  listBoxes(): Promise<EmailBox[]>;

  getMessages(filter: EmailMessageQueryOptions): Promise<EmailMessagePage>;

  searchMessages(filter: EmailSearchOptions): Promise<EmailMessage[]>;

  getMessageById(id: string): Promise<EmailMessage>;

  createDraft(data: DraftEmailData): Promise<EmailDraft>;

  updateDraft(data: UpdateDraftEmailData): Promise<EmailDraft>;

  sendDraft(id: string): Promise<void>;
}
