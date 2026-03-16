import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {
  args: {},
  prompt: {
    description: "The provider name to set",
    required: true,
  },
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({prompt, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const emailService = agent.requireServiceByType(EmailService);
  const providerName = prompt.trim();
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

export default {name: "email provider set", description: "Set the active provider", inputSchema, help, execute} satisfies TokenRingAgentCommand<typeof inputSchema>;
