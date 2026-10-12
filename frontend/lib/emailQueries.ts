import type { EmailProviderCapabilities } from "@tokenring-ai/email";
import { emailRPCClient, useTypedSWR } from "@tokenring-ai/one-frontend/rpc.ts";
import type { z } from "zod";
import type { EmailMessageActionSchema } from "../../rpc/schema.ts";

export type EmailMessageAction = z.input<typeof EmailMessageActionSchema>;

/** What the provider can do beyond reading and sending; undefined until loaded. */
export function useEmailCapabilities(provider: string | null | undefined): EmailProviderCapabilities | undefined {
  const { data } = useTypedSWR(provider ? `/email/getEmailCapabilities/${provider}` : null, () => emailRPCClient.getEmailCapabilities({ provider: provider! }));
  return data?.capabilities;
}

/** Read-only inbox-watch status for the attached agent, refreshed every 30s. */
export function useEmailWatchStatus(agentId: string | null | undefined) {
  return useTypedSWR(agentId ? `/email/getEmailWatchStatus/${agentId}` : null, () => emailRPCClient.getEmailWatchStatus({ agentId: agentId! }), {
    refreshInterval: 30_000,
  });
}

/** Mailboxes a message can be moved into: everything but views and the box it is in. */
export function moveTargets<T extends { id: string }>(boxes: T[], currentBox: string | null | undefined): T[] {
  const unmovable = new Set(["sent", "drafts", "starred"]);
  return boxes.filter(box => !unmovable.has(box.id) && box.id !== currentBox);
}

/** Applies one action to the given messages; resolves the RPC summary. */
export function modifyEmailMessages(provider: string, ids: string[], action: EmailMessageAction) {
  return emailRPCClient.modifyMessages({ provider, ids, action });
}
