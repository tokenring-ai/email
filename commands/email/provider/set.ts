import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const emailService = agent.requireServiceByType(EmailService);
  const providerName = remainder.trim();
  if (!providerName) throw new CommandFailedError("Usage: /email provider set <name>");
  const available = emailService.getAvailableProviders();
  if (available.includes(providerName)) {
    emailService.setActiveProvider(providerName, agent);
    return `Active provider set to: ${providerName}`;
  }
  return `Provider "${providerName}" not found. Available providers: ${available.join(", ")}`;
}

const help = `# /email provider set <name>

Set the active email provider by name.

## Example

/email provider set gmail`;

export default {name: "email provider set", description: "/email provider set - Set the active provider", help, execute} satisfies TokenRingAgentCommand;
