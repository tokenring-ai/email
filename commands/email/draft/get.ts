import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

function execute({ agent }: AgentCommandInputType<typeof inputSchema>): string {
  const draft = agent.requireServiceByType(EmailService).getCurrentDraft(agent);
  return draft ? `Current draft: ${draft.subject}` : "No email draft is currently selected.";
}

export default {
  name: "email draft get",
  description: "Show current draft",
  inputSchema,
  execute,
  help: `Display the currently selected draft subject.

## Example

/email draft get`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
