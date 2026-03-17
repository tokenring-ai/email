import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const message = agent.requireServiceByType(EmailService).getCurrentMessage(agent);
  return message ? `Current message: ${message.subject}` : "No email message is currently selected.";
}

export default {
  name: "email message get",
  description: "Show current message",
  inputSchema,
  execute,
  help: `Display the currently selected email message subject.

## Example

/email message get`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
