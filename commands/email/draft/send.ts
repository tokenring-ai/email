import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {
  args: {},
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const sent = await agent.requireServiceByType(EmailService).sendCurrentDraft(agent);
  return `Sent email "${sent.subject}" to ${sent.to.map(address => address.name ?? address.email).join(", ")}`;
}

export default {
  name: "email draft send",
  description: "Send current draft",
  inputSchema,
  execute,
  help: `# /email draft send

Send the currently selected email draft.

## Example

/email draft send`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
