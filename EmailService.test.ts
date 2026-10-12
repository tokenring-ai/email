import { describe, expect, test } from "bun:test";
import type Agent from "@tokenring-ai/agent/Agent";
import type { InputMessage } from "@tokenring-ai/agent/AgentEvents";
import type { EmailDraft, EmailMessage, EmailProvider } from "./EmailProvider.ts";
import EmailService from "./EmailService.ts";
import { EmailState } from "./state/EmailState.ts";

const sampleMessage: EmailMessage = {
  id: "msg-invoice",
  subject: "Invoice attached",
  from: { email: "billing@example.com", name: "Billing" },
  to: [{ email: "me@example.com" }],
  textBody: "Please pay this invoice",
  isRead: false,
};

const sampleDraft: EmailDraft = {
  id: "draft-1",
  subject: "Hello",
  to: [{ email: "alice@example.com" }],
  textBody: "Hi Alice",
  createdAt: 1,
  updatedAt: 1,
};

function mockProvider(overrides: Partial<EmailProvider> = {}): EmailProvider {
  return {
    description: "mock",
    async listBoxes() {
      return [];
    },
    async getMessages() {
      return { messages: [sampleMessage] };
    },
    async searchMessages() {
      return [];
    },
    async getMessageById() {
      throw new Error("unused");
    },
    async createDraft() {
      throw new Error("unused");
    },
    async updateDraft(data) {
      return {
        ...sampleDraft,
        ...data,
        id: sampleDraft.id,
        createdAt: sampleDraft.createdAt,
        updatedAt: 2,
      };
    },
    async sendDraft() {},
    async markAsRead() {},
    async deleteMessage() {},
    ...overrides,
  };
}

function createAgentHarness(initial?: { draft?: EmailDraft; message?: EmailMessage }) {
  const state = new EmailState({ provider: "mock" });
  if (initial?.draft) state.currentDraft = initial.draft;
  if (initial?.message) state.currentEmail = initial.message;
  const inputs: InputMessage[] = [];
  const agent = {
    getState(Slice: typeof EmailState) {
      if (Slice !== EmailState) throw new Error("unexpected state slice");
      return state;
    },
    mutateState(_Slice: typeof EmailState, callback: (slice: EmailState) => unknown) {
      return callback(state);
    },
    handleInput(input: InputMessage) {
      inputs.push(input);
      return "req-1";
    },
    getAbortSignal() {
      return new AbortController().signal;
    },
  } as unknown as Agent;
  return { agent, state, inputs };
}

describe("EmailService.checkForNewEmails", () => {
  test("selects the matched message then queues the watch command", async () => {
    const service = new EmailService();
    service.registerEmailProvider("mock", mockProvider());
    const { agent, state, inputs } = createAgentHarness();

    await service.checkForNewEmails(
      {
        markAsRead: false,
        unreadOnly: false,
        maxEmailsToConsider: 50,
        actions: [{ pattern: "invoice", command: "/email message info" }],
      },
      agent,
    );

    expect(state.currentEmail?.id).toBe(sampleMessage.id);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.from).toBe("Email from Billing <billing@example.com>");
    expect(inputs[0]?.message).toBe("/email message info");
  });

  test("does not re-process a message that is already recorded", async () => {
    const service = new EmailService();
    service.registerEmailProvider("mock", mockProvider());
    const { agent, state, inputs } = createAgentHarness();
    state.processedEmails.add(sampleMessage.id);

    await service.checkForNewEmails(
      {
        markAsRead: false,
        unreadOnly: false,
        maxEmailsToConsider: 50,
        actions: [{ pattern: "invoice", command: "/email message info" }],
      },
      agent,
    );

    expect(inputs).toHaveLength(0);
  });
});

describe("EmailService.updateDraft", () => {
  test("does not overwrite existing fields with undefined patches", async () => {
    const service = new EmailService();
    let received: EmailDraft | undefined;
    service.registerEmailProvider(
      "mock",
      mockProvider({
        async updateDraft(data) {
          received = data as EmailDraft;
          return { ...sampleDraft, ...data, id: sampleDraft.id, createdAt: sampleDraft.createdAt, updatedAt: 2 };
        },
      }),
    );
    const { agent, state } = createAgentHarness({ draft: sampleDraft });

    const updated = await service.updateDraft(
      { subject: "New subject", to: undefined, textBody: undefined } as unknown as Parameters<EmailService["updateDraft"]>[0],
      agent,
    );

    expect(received?.to).toEqual(sampleDraft.to);
    expect(received?.textBody).toBe(sampleDraft.textBody);
    expect(received?.subject).toBe("New subject");
    expect(updated.subject).toBe("New subject");
    expect(state.currentDraft?.subject).toBe("New subject");
    expect(state.currentDraft?.to).toEqual(sampleDraft.to);
  });
});

describe("EmailService.deleteMessage", () => {
  test("deletes through the active provider and clears the selected message", async () => {
    const deleted: string[] = [];
    const service = new EmailService();
    service.registerEmailProvider(
      "mock",
      mockProvider({
        async deleteMessage(id) {
          deleted.push(id);
        },
      }),
    );
    const { agent, state } = createAgentHarness({ message: sampleMessage });

    await service.deleteMessage(sampleMessage.id, agent);

    expect(deleted).toEqual([sampleMessage.id]);
    expect(state.currentEmail).toBeUndefined();
  });

  test("keeps a different selected message", async () => {
    const service = new EmailService();
    service.registerEmailProvider("mock", mockProvider());
    const { agent, state } = createAgentHarness({ message: sampleMessage });

    await service.deleteMessage("some-other-message", agent);

    expect(state.currentEmail?.id).toBe(sampleMessage.id);
  });

  test("throws when no provider is selected", async () => {
    const service = new EmailService();
    service.registerEmailProvider("mock", mockProvider());
    const { agent, state } = createAgentHarness();
    state.activeProvider = undefined;

    await expect(service.deleteMessage(sampleMessage.id, agent)).rejects.toThrow(/No email provider/);
  });
});

describe("getWatchStatus", () => {
  test("reports an unconfigured, idle watch", () => {
    const service = new EmailService();
    const { agent } = createAgentHarness();
    expect(service.getWatchStatus(agent)).toEqual({
      configured: false,
      running: false,
      pollIntervalSeconds: 60,
      unreadOnly: false,
      markAsRead: false,
      actionCount: 0,
      processedCount: 0,
    });
  });

  test("reports a configured, running watch", () => {
    const service = new EmailService();
    const { agent, state } = createAgentHarness();
    state.watch = { unreadOnly: true, markAsRead: true, maxEmailsToConsider: 10, actions: [{ pattern: "x", command: "y" }] };
    state.isWatching = true;
    state.processedEmails.add("m1");
    expect(service.getWatchStatus(agent)).toMatchObject({
      configured: true,
      running: true,
      unreadOnly: true,
      markAsRead: true,
      actionCount: 1,
      processedCount: 1,
    });
  });
});
