import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import {z} from "zod";
import EmailService from "../EmailService.ts";

const name = "email_getInboxMessages";
const displayName = "Email/getInboxMessages";
const description = "Retrieve recent messages from the current inbox";

const inputSchema = z.object({
  limit: z.number().int().positive().default(25).optional(),
  unreadOnly: z.boolean().optional(),
});

function formatAddress(address: {email: string; name?: string}): string {
  return address.name ? `${address.name} <${address.email}>` : address.email;
}

async function execute({limit, unreadOnly}: z.output<typeof inputSchema>, agent: Agent) {
  const messages = await agent.requireServiceByType(EmailService).getInboxMessages({limit, unreadOnly}, agent);
  return `
Here are the ${messages.length} most recent inbox messages.

${markdownTable(
  ["ID", "From", "Subject", "Received", "Read"],
  messages.map(message => [
    message.id,
    formatAddress(message.from),
    message.subject,
    message.receivedAt.toISOString(),
    message.isRead ? "yes" : "no",
  ]),
)}
  `.trim();
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
