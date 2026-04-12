import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {EmailState} from "../../../state/EmailState.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

function execute({
                   agent,
                 }: AgentCommandInputType<typeof inputSchema>): string {
  return `Current provider: ${agent.getState(EmailState).activeProvider ?? "(none)"}`;
}

export default {
  name: "email provider get",
  description: "Show current provider",
  inputSchema,
  execute,
  help: `Display the currently active email provider.

## Example

/email provider get`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
