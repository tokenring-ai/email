import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import EmailService from "../../EmailService.ts";

const inputSchema = {
  args: {
    box: {
      type: "string",
      required: false,
      description: "Email box to search within",
    },
  },
  remainder: { name: "query", description: "Search query", required: true },
} as const satisfies AgentCommandInputSchema;

async function execute({ args, remainder, agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const query = remainder.trim();
  if (!query) throw new CommandFailedError("Usage: /email search <query>");

  const box = args.box?.trim() || "inbox";
  const messages = await agent.requireServiceByType(EmailService).searchMessages({ query, box }, agent);
  return `
Search results for "${query}" in ${box}:

${markdownTable(
  ["ID", "Subject", "From", "Received"],
  messages.map(message => [message.id, message.subject, message.from.name ?? message.from.email, message.receivedAt.toLocaleString()]),
)}
  `.trim();
}

const help = `Search messages from the active email provider.

## Example

/email search invoice
/email search --box sent invoice
/email search "from:alex@example.com project"`;

export default {
  name: "email search",
  description: "Search messages",
  inputSchema,
  help,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
