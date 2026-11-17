import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import EmailService from "../EmailService.ts";
import { messageIdInput, requireMessageActionApproval, resolveTargetMessage } from "./messageActions.ts";

const name = "email_deleteMessage";
const displayName = "Email/deleteMessage";
const description =
  "Delete an email message. Providers move it to the trash where they can, so the user can restore it. Subject to the user's approval settings, which may run it without asking. Acts on the selected message unless an ID is given.";

/** Removes user data, though recoverably from the provider's trash. */
const DELETE_SAFETY_LEVEL = 6;

const inputSchema = z.object({
  id: messageIdInput,
});

async function execute({ id }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const target = await resolveTargetMessage(name, id, agent);
  await requireMessageActionApproval(
    name,
    {
      message: `Delete ${target.label}?`,
      detailedDescription: "The message is moved to the mail provider's trash, where it can be restored until the provider purges it.",
      safetyLevel: DELETE_SAFETY_LEVEL,
    },
    agent,
  );
  await agent.requireService(EmailService).deleteMessage(target.id, agent);
  return {
    message: `**Email** Deleted ${target.label}`,
    result: `Deleted ${target.label} (ID: ${target.id}). It was moved to the trash.`,
  };
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
