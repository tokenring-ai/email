import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";
import {EmailState} from "../../../state/EmailState.ts";

async function execute(_remainder: string, agent: Agent): Promise<string> {
  const initialProvider = agent.getState(EmailState).initialConfig.provider;
  if (!initialProvider) throw new CommandFailedError("No initial provider configured");
  agent.requireServiceByType(EmailService).setActiveProvider(initialProvider, agent);
  return `Provider reset to ${initialProvider}`;
}

const help = `# /email provider reset

Reset the active email provider to the initial configured value.

## Example

/email provider reset`;

export default {name: "email provider reset", description: "/email provider reset - Reset to initial provider", help, execute} satisfies TokenRingAgentCommand;
