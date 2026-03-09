import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import EmailService from "../EmailService.ts";

const name = "email_updateDraft";
const displayName = "Email/updateDraft";
const description = "Update the currently selected email draft";

const addressSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

const inputSchema = z.object({
  subject: z.string().optional().describe("Updated email subject line"),
  to: z.array(addressSchema).optional().describe("Primary recipients"),
  cc: z.array(addressSchema).optional().describe("CC recipients"),
  bcc: z.array(addressSchema).optional().describe("BCC recipients"),
  textBody: z.string().optional().describe("Updated plain text email body"),
  htmlBody: z.string().optional().describe("Updated HTML email body"),
  threadId: z.string().optional().describe("Optional thread to associate with the draft"),
});

async function execute(input: z.output<typeof inputSchema>, agent: Agent) {
  const draft = await agent.requireServiceByType(EmailService).updateDraft(input, agent);
  agent.infoMessage(`[${name}] Draft updated: ${draft.id}`);
  return {type: "json" as const, data: draft};
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
