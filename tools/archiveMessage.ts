import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import EmailService from "../EmailService.ts";
import { messageIdInput, requireMessageActionApproval, resolveTargetMessage } from "./messageActions.ts";

const name = "email_archiveMessage";
const displayName = "Email/archiveMessage";
const description =
  "Archive an email message: it leaves the inbox but stays searchable. Subject to the user's approval settings, which may run it without asking. Acts on the selected message unless an ID is given. Only providers that support archiving (such as Gmail) can do this.";

/** Changes where existing mail lives; nothing is lost. */
const ARCHIVE_SAFETY_LEVEL = 5;

const inputSchema = z.object({
  id: messageIdInput,
});

async function execute({ id }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const target = await resolveTargetMessage(name, id, agent);
  await requireMessageActionApproval(
    name,
    {
      message: `Archive ${target.label}?`,
      detailedDescription: "The message leaves the inbox. It stays in the account and can be found by search or moved back to the inbox.",
      safetyLevel: ARCHIVE_SAFETY_LEVEL,
    },
    agent,
  );
  await agent.requireService(EmailService).archiveMessage(target.id, agent);
  return {
    message: `**Email** Archived ${target.label}`,
    result: `Archived ${target.label} (ID: ${target.id}).`,
  };
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
