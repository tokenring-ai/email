import {Agent} from "@tokenring-ai/agent";
import {AgentStateSlice} from "@tokenring-ai/agent/types";
import {z} from "zod";
import {type EmailDraft, EmailDraftSchema, type EmailMessage, EmailMessageSchema} from "../EmailProvider.ts";
import {EmailAgentConfigSchema, EmailWatchSchema} from "../schema.ts";

const serializationSchema = z.object({
  activeProvider: z.string().optional(),
  watch: EmailWatchSchema.optional(),
  processedEmails: z.array(z.string()).optional(),
  currentEmail: EmailMessageSchema.optional(),
  currentDraft: EmailDraftSchema.optional(),
}).prefault({});

export class EmailState extends AgentStateSlice<typeof serializationSchema> {
  activeProvider: string | undefined;
  currentEmail: EmailMessage | undefined;
  currentDraft: EmailDraft | undefined;
  watch: z.output<typeof EmailWatchSchema> | undefined;
  processedEmails = new Set<string>();
  isWatching = false;

  constructor(readonly initialConfig: z.output<typeof EmailAgentConfigSchema>) {
    super("EmailState", serializationSchema);
    this.watch = initialConfig.watch;
    this.activeProvider = initialConfig.provider;
  }

  transferStateFromParent(parent: Agent): void {
    const parentState = parent.getState(EmailState);
    this.activeProvider ??= parentState.activeProvider;
    this.currentEmail ??= parentState.currentEmail;
    this.currentDraft ??= parentState.currentDraft;
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      activeProvider: this.activeProvider,
      watch: this.watch,
      processedEmails: Array.from(this.processedEmails),
      currentEmail: this.currentEmail,
      currentDraft: this.currentDraft
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.activeProvider = data.activeProvider;
    this.watch = data.watch;
    this.processedEmails = new Set(data.processedEmails ?? []);
    this.currentEmail = data.currentEmail;
    this.currentDraft = data.currentDraft;
  }

  show(): string[] {
    return [
      `Active Email Provider: ${this.activeProvider}`,
      `Watches:`,
      ...(Object.keys(this.watch?.actions ?? {}).length > 0
        ? Object.entries(this.watch!.actions).map(([key, value]) => `- ${key}: Pattern: ${value.pattern}, Command: ${value.command}`)
        : ["- No watches configured"]),
    ];
  }
}
