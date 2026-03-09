import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import EmailService from "../EmailService.ts";

const name = "email_getCurrentDraft";
const displayName = "Email/getCurrentDraft";
const description = "Retrieve the currently selected email draft";

const inputSchema = z.object({});

async function execute(_input: z.output<typeof inputSchema>, agent: Agent) {
  const draft = agent.requireServiceByType(EmailService).getCurrentDraft(agent);
  return draft ? {type: "json" as const, data: draft} : "No email draft is currently selected.";
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
