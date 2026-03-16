import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {
  args: {},
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  await agent.requireServiceByType(EmailService).clearCurrentDraft(agent);
  return "Draft cleared. No email draft is currently selected.";
}

export default {
  name: "email draft clear",
  description: "Clear current draft selection",
  inputSchema,
  execute,
  help: `# /email draft clear

Clear the current email draft selection.

## Example

/email draft clear`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
