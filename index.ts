export {EmailConfigSchema, EmailAgentConfigSchema} from "./schema.ts";
export {default as EmailService} from "./EmailService.ts";
export type {
  DraftEmailData,
  EmailAddress,
  EmailDraft,
  EmailInboxFilterOptions,
  EmailMessage,
  EmailSearchOptions,
  EmailProvider,
  SentEmail,
  UpdateDraftEmailData,
} from "./EmailProvider.ts";
