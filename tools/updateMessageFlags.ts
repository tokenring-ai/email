import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import EmailService from "../EmailService.ts";
import { messageIdInput, requireMessageActionApproval, resolveTargetMessage } from "./messageActions.ts";

const name = "email_updateMessageFlags";
const displayName = "Email/updateMessageFlags";
const description =
  "Mark an email message read or unread, and/or star or unstar it. Acts on the selected message unless an ID is given. Marking unread and starring need provider support (Gmail has both).";

/** Read/starred flags on your own mail; easily reversed (approval standard: recoverable change). */
const FLAGS_SAFETY_LEVEL = 4;

const inputSchema = z.object({
  id: messageIdInput,
  read: z.boolean().exactOptional().describe("true marks the message read, false marks it unread"),
  starred: z.boolean().exactOptional().describe("true stars the message, false removes the star"),
});

async function execute({ id, read, starred }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  if (read === undefined && starred === undefined) {
    throw new ToolCallError(name, "Pass read and/or starred.");
  }
  const target = await resolveTargetMessage(name, id, agent);
  const changes = [read === undefined ? null : read ? "mark read" : "mark unread", starred === undefined ? null : starred ? "star" : "unstar"].filter(
    (change): change is string => change !== null,
  );
  await requireMessageActionApproval(
    name,
    {
      message: `${changes.join(" and ")} ${target.label}?`,
      detailedDescription: "Only the message's read/star flags change; this is easily undone.",
      safetyLevel: FLAGS_SAFETY_LEVEL,
    },
    agent,
  );
  const emailService = agent.requireService(EmailService);
  if (read === true) await emailService.markAsRead(target.id, agent);
  if (read === false) await emailService.markAsUnread(target.id, agent);
  if (starred !== undefined) await emailService.setStarred(target.id, starred, agent);
  return {
    message: `**Email** Updated ${target.label}`,
    result: `Applied ${changes.join(", ")} to ${target.label} (ID: ${target.id}).`,
  };
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
