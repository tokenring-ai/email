import type Agent from "@tokenring-ai/agent/Agent";
import { permissionSlug } from "@tokenring-ai/chat";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import EmailService from "../EmailService.ts";
import { EmailState } from "../state/EmailState.ts";
import { requireMessageActionApproval } from "./messageActions.ts";

const name = "email_sendCurrentDraft";
const displayName = "Email/sendCurrentDraft";
const description = "Send the currently selected email draft. Requires the user's approval, which shows the recipients, subject and text.";

/**
 * Sending mail as the user cannot be undone, so it sits above the default auto-approve level (6) and
 * is always put to the user. It matters most for watch-triggered runs, where an incoming email's
 * text is what the agent is acting on.
 */
/** Sends to other people (approval standard: reaches people, so a person always approves). */
const SEND_SAFETY_LEVEL = 8;

function formatAddresses(addresses: { email: string; name?: string }[] | undefined): string {
  return (addresses ?? []).map(address => (address.name ? `${address.name} <${address.email}>` : address.email)).join(", ");
}

const inputSchema = z.object({});

async function execute(_input: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const emailService = agent.requireService(EmailService);
  const draft = emailService.getCurrentDraft(agent);
  const account = agent.getState(EmailState).activeProvider;
  if (draft) {
    const text = (draft.textBody ?? draft.htmlBody ?? "").trim();
    await requireMessageActionApproval(
      name,
      {
        message: `Send "${draft.subject || "(no subject)"}" to ${formatAddresses(draft.to) || "no recipients"}?`,
        detailedDescription: [
          `To: ${formatAddresses(draft.to)}`,
          draft.cc?.length ? `Cc: ${formatAddresses(draft.cc)}` : "",
          draft.bcc?.length ? `Bcc: ${formatAddresses(draft.bcc)}` : "",
          `Subject: ${draft.subject}`,
          "",
          text.length > 1500 ? `${text.slice(0, 1500)}…` : text,
        ]
          .filter((line, index) => line !== "" || index === 4)
          .join("\n"),
        safetyLevel: SEND_SAFETY_LEVEL,
        ...(account && { permission: { id: `email.${permissionSlug(account)}.send`, summary: `Send email from ${account}` } }),
      },
      agent,
    );
  }
  const sent = await emailService.sendCurrentDraft(agent);
  agent.infoMessage(`[${name}] Email sent: ${sent.id}`);
  return {
    message: `**Email** Sent current draft`,
    result: JSON.stringify(sent),
  };
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
