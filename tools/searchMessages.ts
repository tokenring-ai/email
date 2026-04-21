import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import { z } from "zod";
import EmailService from "../EmailService.ts";

const name = "email_searchMessages";
const displayName = "Email/searchMessages";
const description = "Search email messages using the active email provider";

const inputSchema = z.object({
  query: z.string().describe("Search query to run against the inbox"),
  box: z.string().exactOptional().describe("Email box to search within, defaults to inbox"),
  limit: z.number().int().positive().default(25).exactOptional(),
  unreadOnly: z.boolean().exactOptional(),
});

async function execute({ query, box, limit, unreadOnly }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const messages = await agent.requireServiceByType(EmailService).searchMessages(stripUndefinedKeys({ query, box, limit, unreadOnly }), agent);
  return `
Found ${messages.length} messages matching "${query}" in ${box ?? "inbox"}.

${markdownTable(
  ["ID", "Subject", "From", "Received"],
  messages.map(message => [message.id, message.subject, message.from.name ?? message.from.email, message.receivedAt.toISOString()]),
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
