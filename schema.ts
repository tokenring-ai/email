import {z} from "zod";

export const EmailAgentConfigSchema = z.object({
  provider: z.string().optional(),
}).default({});

export const EmailConfigSchema = z.object({
  providers: z.record(z.string(), z.any()).default({}),
  agentDefaults: EmailAgentConfigSchema.prefault({}),
});
