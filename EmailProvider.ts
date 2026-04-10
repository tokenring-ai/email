import {z} from "zod";

// Zod schemas
export const EmailAddressSchema = z.object({
  email: z.string(),
  name: z.string().optional(),
});

export const EmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  subject: z.string(),
  from: EmailAddressSchema,
  to: z.array(EmailAddressSchema),
  cc: z.array(EmailAddressSchema).optional(),
  bcc: z.array(EmailAddressSchema).optional(),
  snippet: z.string().optional(),
  textBody: z.string().optional(),
  htmlBody: z.string().optional(),
  labels: z.array(z.string()).optional(),
  isRead: z.boolean(),
  receivedAt: z.date(),
  sentAt: z.date().optional(),
});

export const EmailDraftSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  subject: z.string(),
  to: z.array(EmailAddressSchema),
  cc: z.array(EmailAddressSchema).optional(),
  bcc: z.array(EmailAddressSchema).optional(),
  textBody: z.string().optional(),
  htmlBody: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const EmailBoxSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const EmailMessageQueryOptionsSchema = z.object({
  box: z.string().optional(),
  limit: z.number().optional(),
  unreadOnly: z.boolean().optional(),
  pageToken: z.string().optional(),
});

export const EmailMessagePageSchema = z.object({
  messages: z.array(EmailMessageSchema),
  nextPageToken: z.string().optional(),
});

export const EmailSearchOptionsSchema = z.object({
  query: z.string(),
  box: z.string().optional(),
  limit: z.number().optional(),
  unreadOnly: z.boolean().optional(),
});

// Type inference from schemas
export type EmailAddress = z.infer<typeof EmailAddressSchema>;
export type EmailBox = z.infer<typeof EmailBoxSchema>;
export type EmailMessage = z.infer<typeof EmailMessageSchema>;
export type EmailMessagePage = z.infer<typeof EmailMessagePageSchema>;
export type EmailDraft = z.infer<typeof EmailDraftSchema>;
export type EmailMessageQueryOptions = z.infer<
  typeof EmailMessageQueryOptionsSchema
>;
export type EmailSearchOptions = z.infer<typeof EmailSearchOptionsSchema>;

// Derived types
export type DraftEmailData = Omit<EmailDraft, "id" | "createdAt" | "updatedAt">;
export type UpdateDraftEmailData = Partial<
  Omit<EmailDraft, "id" | "createdAt" | "updatedAt">
>;

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
