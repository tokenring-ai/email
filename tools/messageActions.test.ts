import { describe, expect, mock, test } from "bun:test";
import type Agent from "@tokenring-ai/agent/Agent";
import ChatService from "@tokenring-ai/chat/ChatService";
import type { EmailMessage, EmailProvider } from "../EmailProvider.ts";
import EmailService from "../EmailService.ts";
import { EmailState } from "../state/EmailState.ts";
import archiveMessage from "./archiveMessage.ts";
import deleteMessage from "./deleteMessage.ts";
import moveMessage from "./moveMessage.ts";
import updateMessageFlags from "./updateMessageFlags.ts";

const selected: EmailMessage = {
  id: "m1",
  subject: "Invoice",
  from: { email: "billing@example.com", name: "Billing" },
  to: [],
  isRead: false,
  labels: ["INBOX", "UNREAD"],
};

function harness(approved: boolean, provider: Partial<EmailProvider> = {}) {
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
  emailService.registerEmailProvider("mock", fullProvider);
  const state = new EmailState({ provider: "mock" });
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
