import {Agent} from "@tokenring-ai/agent";
import type {AgentCreationContext} from "@tokenring-ai/agent/types";

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  snippet?: string;
  textBody?: string;
  htmlBody?: string;
  labels?: string[];
  isRead: boolean;
  receivedAt: Date;
  sentAt?: Date;
}

export interface EmailDraft {
  id: string;
  threadId?: string;
  subject: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  textBody?: string;
  htmlBody?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SentEmail {
  id: string;
  threadId?: string;
  subject: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  sentAt: Date;
}

export interface EmailInboxFilterOptions {
  limit?: number;
  unreadOnly?: boolean;
}

export interface EmailSearchOptions {
  query: string;
  limit?: number;
  unreadOnly?: boolean;
}

export type DraftEmailData = Omit<EmailDraft, "id" | "createdAt" | "updatedAt">;

export type UpdateDraftEmailData = Partial<Omit<EmailDraft, "id" | "createdAt" | "updatedAt">>;

export interface EmailProvider {
  description: string;

  attach(agent: Agent, creationContext: AgentCreationContext): void;

  getInboxMessages(filter: EmailInboxFilterOptions, agent: Agent): Promise<EmailMessage[]>;

  searchMessages(filter: EmailSearchOptions, agent: Agent): Promise<EmailMessage[]>;

  selectMessageById(id: string, agent: Agent): Promise<EmailMessage>;

  getCurrentMessage(agent: Agent): EmailMessage | null;

  clearCurrentMessage(agent: Agent): Promise<void>;

  createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft>;

  updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft>;

  getCurrentDraft(agent: Agent): EmailDraft | null;

  clearCurrentDraft(agent: Agent): Promise<void>;

  sendCurrentDraft(agent: Agent): Promise<SentEmail>;
}
