import {z} from "zod";

export const EmailWatchSchema = z.object({
  markAsRead: z.boolean().default(false),
  unreadOnly: z.boolean().default(false),
  maxEmailsToConsider: z.number().int().positive().default(50),
  actions: z.array(z.object({
    pattern: z.string(),
    command: z.string(),
  }))
});

export const EmailAgentConfigSchema = z.object({
  provider: z.string().optional(),
  watch: EmailWatchSchema.optional(),
}).default({});

export const EmailConfigSchema = z.object({
  pollInterval: z.number().default(60).transform(seconds => seconds * 1000),
  agentDefaults: EmailAgentConfigSchema.prefault({}),
});