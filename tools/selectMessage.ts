import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import EmailService from "../EmailService.ts";

const name = "email_selectMessage";
const displayName = "Email/selectMessage";
const description = "Select an email message by ID for further inspection";

const inputSchema = z.object({
  id: z.string().describe("The unique identifier of the email message"),
});

async function execute({id}: z.output<typeof inputSchema>, agent: Agent) {
  const message = await agent.requireServiceByType(EmailService).selectMessageById(id, agent);
  return `
Selected message: "${message.subject}" (ID: ${message.id})
From: ${message.from.name ?? message.from.email}
Received: ${message.receivedAt.toISOString()}

JSON representation:
${JSON.stringify(message, null, 2)}
  `.trim();
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
