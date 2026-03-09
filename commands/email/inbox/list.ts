import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import EmailService from "../../../EmailService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const trimmed = remainder.trim();
  const limit = trimmed ? Number.parseInt(trimmed, 10) : 20;
  if (!Number.isFinite(limit) || limit <= 0) throw new CommandFailedError("Usage: /email inbox list [limit]");

  const messages = await agent.requireServiceByType(EmailService).getInboxMessages({limit}, agent);
  return `
Inbox messages:

${markdownTable(
  ["ID", "From", "Subject", "Received"],
  messages.map(message => [
    message.id,
    message.from.name ?? message.from.email,
    message.subject,
    message.receivedAt.toLocaleString(),
  ]),
)}
  `.trim();
}

const help = `# /email inbox list [limit]

List recent inbox messages from the active provider.

## Example

/email inbox list
/email inbox list 10`;

export default {name: "email inbox list", description: "/email inbox list - List inbox messages", help, execute} satisfies TokenRingAgentCommand;
