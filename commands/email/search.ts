import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import EmailService from "../../EmailService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const query = remainder.trim();
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

const help = `# /email search <query>

Search messages from the active email provider.

## Example

/email search invoice
/email search "from:alex@example.com project"`;

export default {name: "email search", description: "Search messages", help, execute} satisfies TokenRingAgentCommand;
