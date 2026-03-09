import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import EmailService from "../EmailService.ts";

const name = "email_getCurrentMessage";
const displayName = "Email/getCurrentMessage";
const description = "Retrieve the currently selected email message";

const inputSchema = z.object({});

async function execute(_input: z.output<typeof inputSchema>, agent: Agent) {
  const message = agent.requireServiceByType(EmailService).getCurrentMessage(agent);
  return message ? {type: "json" as const, data: message} : "No email message is currently selected.";
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
