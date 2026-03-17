import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import EmailService from "../../EmailService.ts";

const inputSchema = {
  args: {},
  positionals: [{
    name: "query",
    description: "Search query",
    required: true,
    greedy: true,
  }],
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({positionals, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const query = positionals.query.trim();
  if (!query) throw new CommandFailedError("Usage: /email search <query>");

  const messages = await agent.requireServiceByType(EmailService).searchMessages({query}, agent);
  return `
Search results for "${query}":

${markdownTable(
  ["ID", "Subject", "From", "Received"],
  messages.map(message => [
    message.id,
    message.subject,
    message.from.name ?? message.from.email,
    message.receivedAt.toLocaleString(),
  ]),
)}
  `.trim();
}

const help = `Search messages from the active email provider.

## Example

/email search invoice
/email search "from:alex@example.com project"`;

export default {name: "email search", description: "Search messages", inputSchema, help, execute} satisfies TokenRingAgentCommand<typeof inputSchema>;
