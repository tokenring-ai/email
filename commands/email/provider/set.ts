import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {
  args: {},
  positionals: [
    {
      name: "name",
      description: "The provider name to set",
      required: true,
    },
  ],
} as const satisfies AgentCommandInputSchema;

function execute({
                   positionals,
                   agent,
                 }: AgentCommandInputType<typeof inputSchema>): string {
  const emailService = agent.requireServiceByType(EmailService);
  const providerName = positionals.name.trim();
  if (!providerName)
    throw new CommandFailedError("Usage: /email provider set <name>");
  const available = emailService.getAvailableProviders();
  if (available.includes(providerName)) {
    emailService.setActiveProvider(providerName, agent);
    return `Active provider set to: ${providerName}`;
  }
  return `Provider "${providerName}" not found. Available providers: ${available.join(", ")}`;
}

const help = `Set the active email provider by name.

## Example

/email provider set gmail`;

export default {
  name: "email provider set",
  description: "Set the active provider",
  inputSchema,
  help,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
