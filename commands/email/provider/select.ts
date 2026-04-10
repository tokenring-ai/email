import type {TreeLeaf} from "@tokenring-ai/agent/question";
import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand,} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";
import {EmailState} from "../../../state/EmailState.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({
                         agent,
                       }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const emailService = agent.requireServiceByType(EmailService);
  const available = emailService.getAvailableProviders();
  if (available.length === 0) return "No email providers are registered.";
  if (available.length === 1) {
    emailService.setActiveProvider(available[0], agent);
    return `Only one provider configured, auto-selecting: ${available[0]}`;
  }

  const activeProvider = agent.getState(EmailState).activeProvider;
  const tree: TreeLeaf[] = available.map((name: string) => ({
    name: `${name}${name === activeProvider ? " (current)" : ""}`,
    value: name,
  }));
  const selection = await agent.askQuestion({
    message: "Select an active email provider",
    question: {
      type: "treeSelect",
      label: "Email Provider Selection",
      key: "result",
      defaultValue: activeProvider ? [activeProvider] : undefined,
      minimumSelections: 1,
      maximumSelections: 1,
      tree,
    },
  });

  if (selection) {
    emailService.setActiveProvider(selection[0], agent);
    return `Active provider set to: ${selection[0]}`;
  }

  return "Provider selection cancelled.";
}

const help = `Interactively select the active email provider. Auto-selects if only one provider is configured.

## Example

/email provider select`;

export default {
  name: "email provider select",
  description: "Interactively select a provider",
  inputSchema,
  help,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
