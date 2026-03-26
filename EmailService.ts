import Agent from "@tokenring-ai/agent/Agent";
import type {AgentCreationContext} from "@tokenring-ai/agent/types";
import {TokenRingService} from "@tokenring-ai/app/types";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import {z} from "zod";
import type {
  DraftEmailData,
  EmailDraft,
  EmailInboxFilterOptions,
  EmailMessage,
  EmailProvider,
  EmailSearchOptions,
  UpdateDraftEmailData,
} from "./EmailProvider.ts";
import {EmailConfigSchema, EmailAgentConfigSchema, EmailWatchSchema} from "./schema.ts";
import {EmailState} from "./state/EmailState.ts";
import {setTimeout as delay} from "node:timers/promises";

export default class EmailService implements TokenRingService {
  readonly name = "EmailService";
  description = "Abstract interface for email inbox and drafting operations";

  private providers = new KeyedRegistry<EmailProvider>();

  registerEmailProvider = this.providers.register;
  getAvailableProviders = this.providers.getAllItemNames;

  constructor(readonly options: z.output<typeof EmailConfigSchema>) {}

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const agentConfig = deepMerge(this.options.agentDefaults, agent.getAgentConfigSlice("email", EmailAgentConfigSchema));
    const initialState = agent.initializeState(EmailState, agentConfig);
    for (const provider of this.providers.getAllItemValues()) {
      provider.attach?.(agent, creationContext);
    }
    creationContext.items.push(`Selected email provider: ${initialState.activeProvider ?? "(none)"}`);

    if (agentConfig.watch) {
      this.watchEmails(agent);
    }
  }

  watchEmails(agent: Agent): void {
    const wasWatching = agent.mutateState(EmailState, state => {
      if (state.isWatching) return true;
      state.isWatching = true;
      return false;
    });
    if (wasWatching) return;

    agent.runBackgroundTask(async (signal) => {
      while (!signal.aborted) {
        try {
          const watch = agent.getState(EmailState).watch;
          if (!watch) break;

          await this.checkForNewEmails(watch, agent);
          await delay(this.options.pollInterval, null, {signal});
        } catch (error) {
          agent.errorMessage(`Error while checking for new emails: ${error}`);
        }
      }
      agent.mutateState(EmailState, state => {
        state.isWatching = false;
      });
    });
  }

  async checkForNewEmails({ unreadOnly, maxEmailsToConsider, actions }: z.output<typeof EmailWatchSchema>, agent: Agent): Promise<void> {
    const provider = this.requireActiveEmailProvider(agent);
    const messages = await provider.getInboxMessages({ limit: maxEmailsToConsider, unreadOnly }, agent);
    const messagesToProcess = agent.mutateState(EmailState, state => {
      const messagesToProcess: EmailMessage[] = [];
      for (const message of messages) {
        if (!state.processedEmails.has(message.id)) {
          if (!unreadOnly || !message.isRead) {
            messagesToProcess.push(message);
            state.processedEmails.add(message.id);
          }
        }
      }
      return messagesToProcess;
    });

    for (const message of messagesToProcess) {
      if (message.textBody || message.htmlBody) {
        const body = `
From: ${message.from}
To: ${message.to}
Received At: ${message.receivedAt.toISOString()}
Subject: ${message.subject}

${message.textBody ?? message.htmlBody} 
`.trim();

        for (const action of actions) {
          const pattern = new RegExp(action.pattern, "is")
          if (pattern.test(body)) {
            agent.handleInput({
              from: `Email from ${message.from}`,
              message: `/message set --id ${message.id}`
            });

            agent.handleInput({
              message: action.command, from: `Email from ${message.from}`, attachments: [
                {
                  type: "attachment",
                  name: message.subject,
                  encoding: "text",
                  mimeType: "message/rfc822",
                  body,
                  timestamp: Date.now()
                }
              ]
            })
          }
        }
      }
    }
  }

  requireActiveEmailProvider(agent: Agent): EmailProvider {
    const activeProvider = agent.getState(EmailState).activeProvider;
    if (!activeProvider) throw new Error("No email provider is currently selected");
    return this.providers.requireItemByName(activeProvider);
  }

  setActiveProvider(name: string, agent: Agent): void {
    agent.mutateState(EmailState, state => {
      state.activeProvider = name;
    });
  }

  async getInboxMessages(filter: EmailInboxFilterOptions, agent: Agent): Promise<EmailMessage[]> {
    return this.requireActiveEmailProvider(agent).getInboxMessages(filter, agent);
  }

  async searchMessages(filter: EmailSearchOptions, agent: Agent): Promise<EmailMessage[]> {
    return this.requireActiveEmailProvider(agent).searchMessages(filter, agent);
  }

  async getMessageById(id: string, agent: Agent): Promise<EmailMessage> {
    return this.requireActiveEmailProvider(agent).getMessageById(id, agent);
  }

  async selectMessageById(id: string, agent: Agent): Promise<EmailMessage> {
    const emailMessage = await this.getMessageById(id, agent);
    agent.mutateState(EmailState, state => {
      state.currentEmail = emailMessage;
    })
    return emailMessage;
  }

  getCurrentMessage(agent: Agent): EmailMessage | undefined {
    return agent.getState(EmailState).currentEmail;
  }

  async clearCurrentMessage(agent: Agent): Promise<void> {
    agent.mutateState(EmailState, state => {
      state.currentEmail = undefined;
    })
  }

  async createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft> {
    const draft = await this.requireActiveEmailProvider(agent).createDraft(data, agent);
    agent.mutateState(EmailState, state => {
      state.currentDraft = draft;
    })
    return draft;
  }

  async updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft> {
    const currentDraft = this.getCurrentDraft(agent);
    if (!currentDraft) throw new Error("No draft is currently selected");

    const newDraft = {
      ...currentDraft,
      ...data,
    };
    return this.requireActiveEmailProvider(agent).updateDraft(newDraft, agent);
  }

  getCurrentDraft(agent: Agent): EmailDraft | undefined {
    return agent.getState(EmailState).currentDraft;
  }

  async clearCurrentDraft(agent: Agent): Promise<void> {
    agent.mutateState(EmailState, state => {
      state.currentDraft = undefined;
    })
  }

  async sendCurrentDraft(agent: Agent): Promise<EmailDraft> {
    const currentDraft = this.getCurrentDraft(agent);
    if (!currentDraft) throw new Error("No draft is currently selected");

    await this.requireActiveEmailProvider(agent).sendDraft(currentDraft.id, agent);
    return currentDraft;
  }
}
