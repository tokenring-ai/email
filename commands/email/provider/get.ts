import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {EmailState} from "../../../state/EmailState.ts";

const inputSchema = {
  args: {},
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  return `Current provider: ${agent.getState(EmailState).activeProvider ?? "(none)"}`;
}

export default {
  name: "email provider get",
  description: "Show current provider",
  inputSchema,
  execute,
  help: `# /email provider get

Display the currently active email provider.

## Example

/email provider get`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
