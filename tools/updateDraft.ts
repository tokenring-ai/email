import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import EmailService from "../EmailService.ts";

const name = "email_updateDraft";
const displayName = "Email/updateDraft";
const description = "Update the currently selected email draft";

const addressSchema = z.object({
  email: z.string().email(),
  name: z.string().exactOptional(),
});

const inputSchema = z.object({
  subject: z.string().exactOptional().describe("Updated email subject line"),
  to: z.array(addressSchema).exactOptional().describe("Primary recipients"),
  cc: z.array(addressSchema).exactOptional().describe("CC recipients"),
  bcc: z.array(addressSchema).exactOptional().describe("BCC recipients"),
  textBody: z.string().exactOptional().describe("Updated plain text email body"),
  htmlBody: z.string().exactOptional().describe("Updated HTML email body"),
  threadId: z.string().exactOptional().describe("Optional thread to associate with the draft"),
});

async function execute(input: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const draft = await agent.requireServiceByType(EmailService).updateDraft(input, agent);
  agent.infoMessage(`[${name}] Draft updated: ${draft.id}`);
  return JSON.stringify(draft);
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
