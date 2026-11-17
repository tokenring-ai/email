import { describe, expect, mock, test } from "bun:test";
import type TokenRingApp from "@tokenring-ai/app";
import type { EmailMessage, EmailProvider } from "../EmailProvider.ts";
import emailRPC from "./email.ts";

const hit: EmailMessage = { id: "m1", subject: "Budget", from: { email: "a@example.com" }, to: [], isRead: false };

function appWith(provider: Partial<EmailProvider>, agents: unknown[] = []): TokenRingApp {
  // One object stands in for both EmailService and AgentManager.
  return { requireService: () => ({ requireEmailProvider: () => provider, getAgents: () => agents }) } as unknown as TokenRingApp;
}

describe("searchMessages", () => {
  test("passes the page token through and returns the next one", async () => {
    const searchMessagePage = mock(async (_filter: Record<string, unknown>) => ({ messages: [hit], nextPageToken: "p2" }));
    const result = await emailRPC.methods.searchMessages.execute(
      { provider: "gmail", query: "budget", pageToken: "p1" },
      appWith({ searchMessagePage, searchMessages: async () => [] }),
    );

    expect(searchMessagePage.mock.calls[0]![0]).toMatchObject({ query: "budget", box: "inbox", pageToken: "p1" });
    expect(result).toMatchObject({ messages: [hit], count: 1, nextPageToken: "p2" });
  });

  test("falls back to a single page for providers without paged search", async () => {
    const result = await emailRPC.methods.searchMessages.execute({ provider: "gmail", query: "budget" }, appWith({ searchMessages: async () => [hit] }));

    expect(result).toMatchObject({ messages: [hit], count: 1 });
    expect("nextPageToken" in result).toBe(false);
  });
});

describe("markMessageAsRead", () => {
  test("marks the message read through the named provider", async () => {
    const markAsRead = mock(async (_id: string) => {});
    const result = await emailRPC.methods.markMessageAsRead.execute({ provider: "gmail", id: "m1" }, appWith({ markAsRead }));

    expect(markAsRead).toHaveBeenCalledWith("m1");
    expect(result).toEqual({ message: "Marked as read" });
  });
});

describe("getEmailCapabilities", () => {
  test("reports which optional operations the provider implements", async () => {
    const result = await emailRPC.methods.getEmailCapabilities.execute(
      { provider: "gmail" },
      appWith({ archiveMessage: async () => {}, setStarred: async () => {} }),
    );
    expect(result.capabilities).toEqual({ markUnread: false, archive: true, star: true, move: false, resumeDrafts: false });
  });
});

describe("modifyMessages", () => {
  test("applies the action to every id and reports failures without stopping", async () => {
    const moveMessage = mock(async (id: string, _box: string) => {
      if (id === "bad") throw new Error("nope");
    });
    const result = await emailRPC.methods.modifyMessages.execute(
      { provider: "gmail", ids: ["a", "bad", "b"], action: { type: "move", box: "spam" } },
      appWith({ moveMessage }),
    );

    expect(moveMessage.mock.calls.map(call => call[1])).toEqual(["spam", "spam", "spam"]);
    expect(result.succeeded).toEqual(["a", "b"]);
    expect(result.failed).toEqual([{ id: "bad", error: expect.stringContaining("nope") }]);
    expect(result.message).toBe("Moved 2 messages to spam; 1 failed");
  });

  test("stars and marks read through the provider", async () => {
    const setStarred = mock(async (_id: string, _starred: boolean) => {});
    const markAsRead = mock(async (_id: string) => {});
    const starred = await emailRPC.methods.modifyMessages.execute(
      { provider: "gmail", ids: ["a"], action: { type: "star", starred: false } },
      appWith({ setStarred }),
    );
    await emailRPC.methods.modifyMessages.execute({ provider: "gmail", ids: ["a"], action: { type: "markRead" } }, appWith({ markAsRead }));

    expect(setStarred).toHaveBeenCalledWith("a", false);
    expect(starred.message).toBe("Unstarred 1 message");
    expect(markAsRead).toHaveBeenCalledWith("a");
  });

  test("rejects actions the provider does not support", async () => {
    await expect(emailRPC.methods.modifyMessages.execute({ provider: "gmail", ids: ["a"], action: { type: "archive" } }, appWith({}))).rejects.toThrow(
      /does not support archiving/,
    );
  });
});

describe("drafts", () => {
  const draft = { id: "d1", subject: "Hi", to: [{ email: "b@example.com" }], createdAt: 1, updatedAt: 1 };

  test("saveDraft creates a new draft without an id", async () => {
    const createDraft = mock(async (_data: unknown) => draft);
    const result = await emailRPC.methods.saveDraft.execute(
      { provider: "gmail", subject: "Hi", to: [{ email: "b@example.com" }], textBody: "x", threadId: "t1" },
      appWith({ createDraft }),
    );
    expect(createDraft.mock.calls[0]![0]).toEqual({ subject: "Hi", to: [{ email: "b@example.com" }], textBody: "x", threadId: "t1" });
    expect(result.draft).toEqual(draft);
  });

  test("saveDraft updates the named draft in place", async () => {
    const updateDraft = mock(async (_data: { id?: string }) => draft);
    await emailRPC.methods.saveDraft.execute({ provider: "gmail", id: "d1", subject: "Hi", to: [] }, appWith({ updateDraft }));
    expect(updateDraft.mock.calls[0]![0]).toMatchObject({ id: "d1", subject: "Hi" });
  });

  test("saveDraft refreshes the copy of the draft an agent has selected", async () => {
    const state: { activeProvider: string; currentDraft: unknown } = { activeProvider: "gmail", currentDraft: { ...draft, textBody: "old text" } };
    const agent = { getState: () => state, mutateState: (_slice: unknown, fn: (s: typeof state) => void) => fn(state) };
    await emailRPC.methods.saveDraft.execute({ provider: "gmail", id: draft.id, subject: "Hi", to: [] }, appWith({ updateDraft: async () => draft }, [agent]));
    expect(state.currentDraft).toEqual(draft);
  });

  test("getDraftForMessage resolves a Drafts-box message, or null", async () => {
    const getDraftByMessageId = async (id: string) => (id === "m-d1" ? draft : undefined);
    expect((await emailRPC.methods.getDraftForMessage.execute({ provider: "gmail", messageId: "m-d1" }, appWith({ getDraftByMessageId }))).draft).toEqual(
      draft,
    );
    expect((await emailRPC.methods.getDraftForMessage.execute({ provider: "gmail", messageId: "x" }, appWith({ getDraftByMessageId }))).draft).toBeNull();
  });

  test("sendDraft sends the server draft by id", async () => {
    const sendDraft = mock(async (_id: string) => {});
    await emailRPC.methods.sendDraft.execute({ provider: "gmail", id: "d1" }, appWith({ sendDraft }));
    expect(sendDraft).toHaveBeenCalledWith("d1");
  });
});
