import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";
import {EmailState} from "../../../state/EmailState.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const initialProvider = agent.getState(EmailState).initialConfig.provider;
  if (!initialProvider) throw new CommandFailedError("No initial provider configured");
  agent.requireServiceByType(EmailService).setActiveProvider(initialProvider, agent);
  return `Provider reset to ${initialProvider}`;
}

const help = `Reset the active email provider to the initial configured value.

## Example

/email provider reset`;

export default {name: "email provider reset", description: "Reset to initial provider", inputSchema, help, execute} satisfies TokenRingAgentCommand<typeof inputSchema>;
