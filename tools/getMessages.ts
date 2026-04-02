import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import {z} from "zod";
import EmailService from "../EmailService.ts";

const name = "email_getMessages";
const displayName = "Email/getMessages";
const description = "Retrieve messages from a selected email box";

const inputSchema = z.object({
  box: z.string().optional().describe("Email box to read from, defaults to inbox"),
  limit: z.number().int().positive().default(25).optional(),
  unreadOnly: z.boolean().optional(),
  pageToken: z.string().optional().describe("Pagination token returned by a previous call"),
});

function formatAddress(address: {email: string; name?: string}): string {
  return address.name ? `${address.name} <${address.email}>` : address.email;
}

async function execute({box, limit, unreadOnly, pageToken}: z.output<typeof inputSchema>, agent: Agent) {
  const page = await agent.requireServiceByType(EmailService).getMessages({box, limit, unreadOnly, pageToken}, agent);
  const boxName = box ?? "inbox";
  return `
Here are the ${page.messages.length} most recent messages from ${boxName}.

${markdownTable(
  ["ID", "From", "Subject", "Received", "Read"],
  page.messages.map(message => [
    message.id,
    formatAddress(message.from),
    message.subject,
    message.receivedAt.toISOString(),
    message.isRead ? "yes" : "no",
  ]),
)}
${page.nextPageToken ? `\n\nNext page token: ${page.nextPageToken}` : ""}
  `.trim();
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
