import type Agent from "@tokenring-ai/agent/Agent";
import ChatService from "@tokenring-ai/chat/ChatService";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import EmailService from "../EmailService.ts";

/** Shared `id` input: the message to act on, defaulting to the selected one. */
export const messageIdInput = z.string().exactOptional().describe("ID of the message to act on. Defaults to the currently selected message.");

export interface ResolvedMessage {
  id: string;
  /** "Subject" from sender, for approval prompts and results. */
  label: string;
}

/** Resolves the target message (explicit id or the selection) and a human label for it. */
export async function resolveTargetMessage(toolName: string, id: string | undefined, agent: Agent): Promise<ResolvedMessage> {
  const emailService = agent.requireService(EmailService);
  const current = emailService.getCurrentMessage(agent);
  const targetId = id ?? current?.id;
  if (!targetId) {
    throw new ToolCallError(toolName, "No message ID was given and no message is selected. Select a message or pass its ID.");
  }
  let message = current?.id === targetId ? current : undefined;
  if (!message) {
    try {
      message = await emailService.getMessageById(targetId, agent);
    } catch {
      // The provider call below reports a bad id; the label just falls back to the id.
    }
  }
  const label = message ? `"${message.subject || "(no subject)"}" from ${message.from.name ?? message.from.email}` : `message ${targetId}`;
  return { id: targetId, label };
}

/**
 * Runs the workspace tool-approval policy (auto-approve threshold, ask or
 * reject) for a mailbox change. Throws when the user does not approve.
 */
export async function requireMessageActionApproval(
  toolName: string,
  {
    message,
    detailedDescription,
    safetyLevel,
    permission,
  }: { message: string; detailedDescription: string; safetyLevel: number; permission?: { id: string; summary: string } },
  agent: Agent,
): Promise<void> {
  const approved = await agent
    .requireService(ChatService)
    .checkToolApproval({ toolName, message, detailedDescription, safetyLevel, default: false, ...(permission && { permission }) }, agent);
  if (!approved) {
    throw new ToolCallError(toolName, "User did not approve this change to their mailbox.");
  }
}
