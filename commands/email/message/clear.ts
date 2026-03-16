import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {
  args: {},
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  await agent.requireServiceByType(EmailService).clearCurrentMessage(agent);
  return "Message cleared. No email message is currently selected.";
}

export default {
  name: "email message clear",
  description: "Clear current message selection",
  inputSchema,
  execute,
  help: `# /email message clear

Clear the current email message selection.

## Example

/email message clear`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
