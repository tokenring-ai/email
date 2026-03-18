import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import EmailService from "../../../EmailService.ts";

const inputSchema = {
  args: {
    "--limit": {
      type: "number",
      required: false,
      description: "Optional limit for number of messages",
    }
  }
} as const satisfies AgentCommandInputSchema;

async function execute({args, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const limit = args["--limit"] ?? 20
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

const help = `List recent inbox messages from the active provider.

## Example

/email inbox list
/email inbox list --limit 10`;

export default {name: "email inbox list", description: "List inbox messages", inputSchema, help, execute} satisfies TokenRingAgentCommand<typeof inputSchema>;
