import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import EmailService from "../EmailService.ts";

const name = "email_sendCurrentDraft";
const displayName = "Email/sendCurrentDraft";
const description = "Send the currently selected email draft";

const inputSchema = z.object({});

async function execute(_input: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const sent = await agent.requireServiceByType(EmailService).sendCurrentDraft(agent);
  agent.infoMessage(`[${name}] Email sent: ${sent.id}`);
  return JSON.stringify(sent);
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
