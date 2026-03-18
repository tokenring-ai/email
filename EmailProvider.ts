import { z } from 'zod';
import { Agent } from "@tokenring-ai/agent";
import type { AgentCreationContext } from "@tokenring-ai/agent/types";

// Zod schemas
export const EmailAddressSchema = z.object({
  email: z.string().email(),
  name: z.string().optional()
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
  sentAt: z.date().optional()
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
  updatedAt: z.date()
});

export const EmailInboxFilterOptionsSchema = z.object({
  limit: z.number().optional(),
  unreadOnly: z.boolean().optional()
});

export const EmailSearchOptionsSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  unreadOnly: z.boolean().optional()
});

// Type inference from schemas
export type EmailAddress = z.infer<typeof EmailAddressSchema>;
export type EmailMessage = z.infer<typeof EmailMessageSchema>;
export type EmailDraft = z.infer<typeof EmailDraftSchema>;
export type EmailInboxFilterOptions = z.infer<typeof EmailInboxFilterOptionsSchema>;
export type EmailSearchOptions = z.infer<typeof EmailSearchOptionsSchema>;

// Derived types
export type DraftEmailData = Omit<EmailDraft, "id" | "createdAt" | "updatedAt">;
export type UpdateDraftEmailData = Partial<Omit<EmailDraft, "id" | "createdAt" | "updatedAt">>;

export interface EmailProvider {
  description: string;

  attach?(agent: Agent, creationContext: AgentCreationContext): void;

  getInboxMessages(filter: EmailInboxFilterOptions, agent: Agent): Promise<EmailMessage[]>;

  searchMessages(filter: EmailSearchOptions, agent: Agent): Promise<EmailMessage[]>;

  getMessageById(id: string, agent: Agent): Promise<EmailMessage>;

  createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft>;

  updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft>;

  sendDraft(id: string, agent: Agent): Promise<void>;
}
