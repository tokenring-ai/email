import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {
  args: {
    "id": {
      type: "string",
      required: true,
      description: "The ID of the message to select",
    },
  },
} as const satisfies AgentCommandInputSchema;

async function execute({
                         args,
                         agent,
                       }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const message = await agent
    .requireServiceByType(EmailService)
    .selectMessageById(args.id, agent);
  return `Selected message: ${message.subject}`;
}

export default {
  name: "email message set",
  description: "Select an email message by ID",
  inputSchema,
  execute,
  help: `Select an email message by its ID.

## Example

/email message set --id 12345`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
