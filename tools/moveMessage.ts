import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import EmailService from "../EmailService.ts";
import { messageIdInput, requireMessageActionApproval, resolveTargetMessage } from "./messageActions.ts";

const name = "email_moveMessage";
const displayName = "Email/moveMessage";
const description =
  "Move an email message to another mailbox, such as inbox, spam or trash (Gmail also accepts a user label name). Subject to the user's approval settings, which may run it without asking. Acts on the selected message unless an ID is given.";

const MOVE_SAFETY_LEVEL = 5;
/** Moving to the trash is a (recoverable) delete. */
const TRASH_SAFETY_LEVEL = 6;

const inputSchema = z.object({
  id: messageIdInput,
  box: z.string().min(1).describe('Destination mailbox id, e.g. "inbox", "spam" or "trash", or a label name'),
});

async function execute({ id, box }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const target = await resolveTargetMessage(name, id, agent);
  const toTrash = box.trim().toLowerCase() === "trash";
  await requireMessageActionApproval(
    name,
    {
      message: `Move ${target.label} to ${box}?`,
      detailedDescription: toTrash
        ? "The message is moved to the trash, where it can be restored until the provider purges it."
        : `The message is moved to ${box}; it can be moved back later.`,
      safetyLevel: toTrash ? TRASH_SAFETY_LEVEL : MOVE_SAFETY_LEVEL,
    },
    agent,
  );
  await agent.requireService(EmailService).moveMessage(target.id, box, agent);
  return {
    message: `**Email** Moved ${target.label} to ${box}`,
    result: `Moved ${target.label} (ID: ${target.id}) to ${box}.`,
  };
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
