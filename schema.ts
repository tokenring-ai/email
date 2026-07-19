import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { z } from "zod";

export const EmailWatchSchema = z.object({
  markAsRead: z
    .boolean()
    .default(false)
    .meta({ description: "Mark matched emails as read after processing" } satisfies ConfigFieldMeta),
  unreadOnly: z
    .boolean()
    .default(false)
    .meta({ description: "Only consider unread emails" } satisfies ConfigFieldMeta),
  maxEmailsToConsider: z
    .number()
    .int()
    .positive()
    .default(50)
    .meta({ advanced: true, description: "Maximum number of emails checked per poll" } satisfies ConfigFieldMeta),
  actions: z
    .array(
      z.object({
        pattern: z.string().meta({ description: "Pattern matched against email content" } satisfies ConfigFieldMeta),
        command: z.string().meta({ description: "Command/prompt run when the pattern matches" } satisfies ConfigFieldMeta),
      }),
    )
    .meta({ description: "Actions triggered by matching emails" } satisfies ConfigFieldMeta),
});

export const EmailAgentConfigSchema = z
  .object({
    provider: z.string().exactOptional(),
    watch: EmailWatchSchema.exactOptional(),
  })
  .default({});

export const EmailConfigSchema = z
  .object({
    pollInterval: z
      .number()
      .default(60)
      .meta({ unit: "s", advanced: true, description: "How often mailboxes are polled" } satisfies ConfigFieldMeta)
      .transform(seconds => seconds * 1000),
    agentDefaults: EmailAgentConfigSchema.prefault({}).meta({ label: "Agent Defaults" } satisfies ConfigFieldMeta),
  })
  .meta({ label: "Email", description: "Email integration and mailbox-watching settings" } satisfies ConfigFieldMeta);
