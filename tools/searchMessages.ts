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
  limit: z.number().int().positive().max(100).default(25).describe("Most results to return (up to 100)"),
  unreadOnly: z.boolean().exactOptional(),
});

async function execute({ query, box, limit, unreadOnly }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const messages = await agent.requireService(EmailService).searchMessages(stripUndefinedKeys({ query, box, limit, unreadOnly }), agent);
  // A full page means the search stopped at the limit, not that these are all the matches.
  const capped = messages.length >= limit;
  const note = capped
    ? `\n\nThese are only the first ${limit} matches; there may be more. Narrow the query (sender, date, words in the subject) or raise \`limit\` (up to 100) to see others.`
    : "";
  return {
    message: `**Email** Found ${messages.length}${capped ? "+" : ""} results for "${query}"`,
    result: `
Found ${messages.length}${capped ? " (or more)" : ""} messages matching "${query}" in ${box ?? "inbox"}.${note}

${markdownTable(
  ["ID", "Subject", "From", "Received"],
  messages.map(message => [
    message.id,
    message.subject,
    message.from.name ?? message.from.email,
    message.receivedAt != null ? new Date(message.receivedAt).toISOString() : "—",
  ]),
)}
  `.trim(),
  };
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
