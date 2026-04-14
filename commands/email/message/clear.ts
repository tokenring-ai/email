import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

function execute({
                         agent,
                       }: AgentCommandInputType<typeof inputSchema>) {
  agent.requireServiceByType(EmailService).clearCurrentMessage(agent);
  return "Message cleared. No email message is currently selected.";
}

export default {
  name: "email message clear",
  description: "Clear current message selection",
  inputSchema,
  execute,
  help: `Clear the current email message selection.

## Example

/email message clear`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
