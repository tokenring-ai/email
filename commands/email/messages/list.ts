import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import EmailService from "../../../EmailService.ts";

const inputSchema = {
  args: {
    "box": {
      type: "string",
      required: false,
      description: "Email box to list from",
    },
    "limit": {
      type: "number",
      required: false,
      description: "Optional limit for number of messages",
    },
    "page-token": {
      type: "string",
      required: false,
      description: "Pagination token returned by a previous list call",
    },
  },
} as const satisfies AgentCommandInputSchema;

async function execute({
                         args,
                         agent,
                       }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const box = args.box?.trim() || "inbox";
  const limit = args.limit ?? 20;
  if (!Number.isFinite(limit) || limit <= 0)
    throw new CommandFailedError(
      "Usage: /email messages list --box <box> --limit <limit>",
    );

  const page = await agent.requireServiceByType(EmailService).getMessages(
    {
      box,
      limit,
      pageToken: args["page-token"]?.trim() || undefined,
    },
    agent,
  );
  return `
Messages in ${box}:

${markdownTable(
    ["ID", "From", "Subject", "Received"],
    page.messages.map((message) => [
      message.id,
      message.from.name ?? message.from.email,
      message.subject,
      message.receivedAt.toLocaleString(),
    ]),
)}
${page.nextPageToken ? `\n\nNext page token: ${page.nextPageToken}` : ""}
  `.trim();
}

const help = `List recent messages from a selected email box.

## Example

/email messages list
/email messages list --box sent
/email messages list --limit 10 --page-token <token>`;

export default {
  name: "email messages list",
  description: "List messages",
  inputSchema,
  help,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
