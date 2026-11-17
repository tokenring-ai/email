import { describe, expect, mock, test } from "bun:test";
import type Agent from "@tokenring-ai/agent/Agent";
import ChatService from "@tokenring-ai/chat/ChatService";
import { permissionSlug } from "@tokenring-ai/chat/permissions/permissionIds";
import type { EmailMessage, EmailProvider } from "../EmailProvider.ts";
import EmailService from "../EmailService.ts";
import { EmailState } from "../state/EmailState.ts";
import archiveMessage from "./archiveMessage.ts";
import deleteMessage from "./deleteMessage.ts";
import moveMessage from "./moveMessage.ts";
import searchMessages from "./searchMessages.ts";
import sendCurrentDraft from "./sendCurrentDraft.ts";
import updateMessageFlags from "./updateMessageFlags.ts";

const selected: EmailMessage = {
  id: "m1",
  subject: "Invoice",
  from: { email: "billing@example.com", name: "Billing" },
  to: [],
  isRead: false,
  labels: ["INBOX", "UNREAD"],
};

function harness(approved: boolean, provider: Partial<EmailProvider> = {}, providerName = "mock") {
  const fullProvider: EmailProvider = {
    description: "mock",
    listBoxes: async () => [],
    getMessages: async () => ({ messages: [] }),
    searchMessages: async () => [],
    getMessageById: async id => ({ ...selected, id, subject: "Other" }),
    createDraft: async () => {
      throw new Error("unused");
    },
    updateDraft: async () => {
      throw new Error("unused");
    },
    sendDraft: async () => {},
    markAsRead: mock(async () => {}),
    deleteMessage: mock(async () => {}),
    ...provider,
  };
  const emailService = new EmailService();
  emailService.registerEmailProvider(providerName, fullProvider);
  const state = new EmailState({ provider: providerName });
  state.currentEmail = selected;
  const checkToolApproval = mock(async (_options: { safetyLevel: number; message: string }) => approved);
  const agent = {
    requireService(Service: unknown) {
      if (Service === EmailService) return emailService;
      if (Service === ChatService) return { checkToolApproval };
      throw new Error("unexpected service");
    },
    getState: () => state,
    mutateState: (_slice: unknown, fn: (s: EmailState) => unknown) => fn(state),
  } as unknown as Agent;
  return { agent, state, provider: fullProvider, checkToolApproval };
}

describe("email mailbox tools", () => {
  test("delete defaults to the selected message, asks first and clears the selection", async () => {
    const { agent, state, provider, checkToolApproval } = harness(true);
    const result = await deleteMessage.execute(deleteMessage.inputSchema.parse({}), agent);

    expect(provider.deleteMessage).toHaveBeenCalledWith("m1");
    expect(checkToolApproval.mock.calls[0]![0]).toMatchObject({ safetyLevel: 6, message: expect.stringContaining('"Invoice" from Billing') });
    expect(state.currentEmail).toBeUndefined();
    expect(result.message).toContain("Deleted");
  });

  test("mailbox changes name no permission", async () => {
    const { agent, checkToolApproval } = harness(true);
    await deleteMessage.execute(deleteMessage.inputSchema.parse({}), agent);
    expect(checkToolApproval.mock.calls[0]![0]).not.toHaveProperty("permission");
  });

  test("nothing changes when the user declines", async () => {
    const { agent, provider } = harness(false);
    await expect(deleteMessage.execute(deleteMessage.inputSchema.parse({ id: "m2" }), agent)).rejects.toThrow(/did not approve/);
    expect(provider.deleteMessage).not.toHaveBeenCalled();
  });

  test("fails clearly with no id and no selection", async () => {
    const { agent, state } = harness(true);
    state.currentEmail = undefined;
    await expect(archiveMessage.execute(archiveMessage.inputSchema.parse({}), agent)).rejects.toThrow(/no message is selected/);
  });

  test("archive goes through the provider and updates the selected message's labels", async () => {
    const archive = mock(async (_id: string) => {});
    const { agent, state } = harness(true, { archiveMessage: archive });
    await archiveMessage.execute(archiveMessage.inputSchema.parse({}), agent);

    expect(archive).toHaveBeenCalledWith("m1");
    expect(state.currentEmail?.labels).toEqual(["UNREAD"]);
  });

  test("archive reports providers that cannot archive", async () => {
    const { agent } = harness(true);
    await expect(archiveMessage.execute(archiveMessage.inputSchema.parse({}), agent)).rejects.toThrow(/does not support archiving/);
  });

  test("moving to the trash is gated at the delete level", async () => {
    const move = mock(async (_id: string, _box: string) => {});
    const { agent, state, checkToolApproval } = harness(true, { moveMessage: move });
    await moveMessage.execute(moveMessage.inputSchema.parse({ box: "trash" }), agent);

    expect(move).toHaveBeenCalledWith("m1", "trash");
    expect(checkToolApproval.mock.calls[0]![0].safetyLevel).toBe(6);
    expect(state.currentEmail).toBeUndefined();
  });

  test("moving elsewhere keeps the selection", async () => {
    const move = mock(async (_id: string, _box: string) => {});
    const { agent, state, checkToolApproval } = harness(true, { moveMessage: move });
    await moveMessage.execute(moveMessage.inputSchema.parse({ id: "m1", box: "spam" }), agent);

    expect(checkToolApproval.mock.calls[0]![0].safetyLevel).toBe(5);
    expect(state.currentEmail?.id).toBe("m1");
  });

  test("flags mark unread and star the message", async () => {
    const markAsUnread = mock(async (_id: string) => {});
    const setStarred = mock(async (_id: string, _starred: boolean) => {});
    const { agent, state } = harness(true, { markAsUnread, setStarred });
    await updateMessageFlags.execute(updateMessageFlags.inputSchema.parse({ read: false, starred: true }), agent);

    expect(markAsUnread).toHaveBeenCalledWith("m1");
    expect(setStarred).toHaveBeenCalledWith("m1", true);
    expect(state.currentEmail).toMatchObject({ isRead: false, isStarred: true });
  });

  test("flags require at least one change", async () => {
    const { agent } = harness(true);
    await expect(updateMessageFlags.execute(updateMessageFlags.inputSchema.parse({}), agent)).rejects.toThrow(/read and\/or starred/);
  });
});

describe("sending", () => {
  const draft = {
    id: "d1",
    subject: "Quarterly numbers",
    to: [{ email: "cfo@example.com", name: "CFO" }],
    cc: [{ email: "team@example.com" }],
    textBody: "Attached are the numbers.",
    createdAt: 1,
    updatedAt: 1,
  };

  test("always asks first, showing the recipients, subject and text", async () => {
    const sendDraft = mock(async () => {});
    const { agent, state, checkToolApproval } = harness(true, { sendDraft });
    Object.assign(agent, { infoMessage: () => {} });
    state.currentDraft = draft;

    await sendCurrentDraft.execute(sendCurrentDraft.inputSchema.parse({}), agent);

    const request = checkToolApproval.mock.calls[0]![0] as { safetyLevel: number; message: string; detailedDescription: string };
    // Above the default auto-approve level (6), so it is never sent silently.
    expect(request.safetyLevel).toBeGreaterThan(6);
    expect(request.message).toBe('Send "Quarterly numbers" to CFO <cfo@example.com>?');
    expect(request.detailedDescription).toContain("Cc: team@example.com");
    expect(request.detailedDescription).toContain("Attached are the numbers.");
    expect(sendDraft).toHaveBeenCalledWith("d1");
  });

  test("names a permission for the account, slugged", async () => {
    const { agent, state, checkToolApproval } = harness(true, { sendDraft: async () => {} }, "Work Mail.com");
    Object.assign(agent, { infoMessage: () => {} });
    state.currentDraft = draft;
    await sendCurrentDraft.execute(sendCurrentDraft.inputSchema.parse({}), agent);
    const request = checkToolApproval.mock.calls[0]![0] as { permission?: unknown; safetyLevel: number };
    expect(request.permission).toEqual({ id: `email.${permissionSlug("Work Mail.com")}.send`, summary: "Send email from Work Mail.com" });
    expect(request.safetyLevel).toBe(8);
  });

  test("sends nothing when the user declines", async () => {
    const sendDraft = mock(async () => {});
    const { agent, state } = harness(false, { sendDraft });
    state.currentDraft = draft;

    await expect(sendCurrentDraft.execute(sendCurrentDraft.inputSchema.parse({}), agent)).rejects.toThrow(/did not approve/);
    expect(sendDraft).not.toHaveBeenCalled();
  });
});

describe("searching", () => {
  test("says when the results stopped at the limit", async () => {
    const found = Array.from({ length: 5 }, (_, index) => ({ ...selected, id: `m${index}` }));
    const { agent } = harness(true, { searchMessages: async () => found });
    const full = await searchMessages.execute(searchMessages.inputSchema.parse({ query: "invoice", limit: 5 }), agent);
    expect(full.result).toContain("there may be more");

    const { agent: other } = harness(true, { searchMessages: async () => found.slice(0, 2) });
    const partial = await searchMessages.execute(searchMessages.inputSchema.parse({ query: "invoice", limit: 5 }), other);
    expect(partial.result).not.toContain("there may be more");
  });
});
