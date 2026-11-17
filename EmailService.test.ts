import { describe, expect, test } from "bun:test";
import type Agent from "@tokenring-ai/agent/Agent";
import type { InputMessage } from "@tokenring-ai/agent/AgentEvents";
import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import type { EmailDraft, EmailMessage, EmailProvider } from "./EmailProvider.ts";
import EmailService from "./EmailService.ts";
import { EmailConfigSchema } from "./schema.ts";
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
  test("acts on new mail while the agent is idle, as the watch loop does", async () => {
    const app = createTestingApp();
    const service = new EmailService(EmailConfigSchema.parse({ agentDefaults: { provider: "mock" } }));
    service.registerEmailProvider("mock", mockProvider());
    app.addService(EmailService, service);
    // A real agent with no input running: the watch loop polls between turns.
    const agent = createTestingAgent(app);
    const sent: string[] = [];
    agent.handleInput = ({ message }) => {
      sent.push(message);
      return "req-1";
    };

    await service.checkForNewEmails(
      { markAsRead: false, unreadOnly: false, maxEmailsToConsider: 50, actions: [{ pattern: "invoice", command: "/email message info" }] },
      agent,
    );
    expect(sent).toHaveLength(1);
  });

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

describe("EmailService watch loop", () => {
  test("waits between checks when a check fails, instead of spinning and freezing the server", async () => {
    // No provider registered, so every check throws before it awaits anything.
    const service = new EmailService(EmailConfigSchema.parse({ pollInterval: 0.02 }));
    const { agent, state } = createAgentHarness();
    state.watch = { unreadOnly: true, markAsRead: false, maxEmailsToConsider: 10, actions: [] };
    const errors: string[] = [];
    const controller = new AbortController();
    let loop: Promise<void> = Promise.resolve();
    Object.assign(agent, {
      errorMessage: (message: string) => errors.push(message),
      runBackgroundTask: (task: (signal: AbortSignal) => Promise<void>) => {
        loop = task(controller.signal);
      },
    });

    service.watchEmails(agent);
    // With the old loop this timer never fired: the retry chain never yielded to it.
    await new Promise(resolve => setTimeout(resolve, 120));
    controller.abort();
    await loop;

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.length).toBeLessThan(15);
    expect(state.isWatching).toBe(false);
  });
});

describe("EmailService.checkForNewEmails robustness", () => {
  test("skips an invalid pattern, still runs the valid ones and records the message", async () => {
    const service = new EmailService();
    service.registerEmailProvider("mock", mockProvider());
    const { agent, state, inputs } = createAgentHarness();
    const errors: string[] = [];
    Object.assign(agent, { errorMessage: (message: string) => errors.push(message) });

    await service.checkForNewEmails(
      {
        markAsRead: false,
        unreadOnly: false,
        maxEmailsToConsider: 50,
        actions: [
          { pattern: "(urgent", command: "/never" },
          { pattern: "invoice", command: "/email message info" },
        ],
      },
      agent,
    );

    expect(errors[0]).toContain("not a valid regular expression");
    expect(inputs.map(input => input.message)).toEqual(["/email message info"]);
    expect(state.processedEmails.has(sampleMessage.id)).toBe(true);
  });

  test("leaves mail not reached before a shutdown unprocessed, to handle next time", async () => {
    const second = { ...sampleMessage, id: "msg-2" };
    const service = new EmailService();
    service.registerEmailProvider("mock", mockProvider({ getMessages: async () => ({ messages: [sampleMessage, second] }) }));
    const { agent, state } = createAgentHarness();
    const controller = new AbortController();
    Object.assign(agent, {
      getAbortSignal: () => controller.signal,
      handleInput: () => {
        controller.abort();
        return "req-1";
      },
    });

    await service.checkForNewEmails({ markAsRead: false, unreadOnly: false, maxEmailsToConsider: 50, actions: [{ pattern: "invoice", command: "/x" }] }, agent);

    expect([...state.processedEmails]).toEqual([sampleMessage.id]);
  });
});

describe("EmailService when the selected provider's account was disconnected", () => {
  test("says the provider is no longer available instead of failing obscurely, and recovers once another is selected", async () => {
    const service = new EmailService(EmailConfigSchema.parse({}));
    service.registerEmailProvider("mock", mockProvider());
    service.registerEmailProvider("other", mockProvider());
    const { agent } = createAgentHarness();

    expect(service.requireActiveEmailProvider(agent)).toBeDefined();
    service.unregisterEmailProvider("mock");

    expect(() => service.requireActiveEmailProvider(agent)).toThrow(/"mock" is no longer available.*Select another/);
    expect(() => service.getBoxes(agent)).toThrow("no longer available");
    service.setActiveProvider("other", agent);
    expect(service.requireActiveEmailProvider(agent)).toBeDefined();
  });
});
