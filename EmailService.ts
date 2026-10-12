import { setTimeout as delay } from "node:timers/promises";
import type Agent from "@tokenring-ai/agent/Agent";
import type { AgentCreationContext } from "@tokenring-ai/agent/types";
import type { TokenRingService } from "@tokenring-ai/app/types";
import { ConfigurationError } from "@tokenring-ai/app/types";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import type { z } from "zod";
import type {
  DraftEmailData,
  EmailBox,
  EmailDraft,
  EmailMessage,
  EmailMessagePage,
  EmailMessageQueryOptions,
  EmailProvider,
  EmailSearchOptions,
  UpdateDraftEmailData,
} from "./EmailProvider.ts";
import { EmailAgentConfigSchema, EmailConfigSchema, type EmailWatchSchema } from "./schema.ts";
import { EmailState } from "./state/EmailState.ts";
import { combineEmailAddressAndName } from "./util/emailAddress.ts";
import { emailToRFC822 } from "./util/emailToRFC822.ts";

export type ParsedEmailConfig = z.output<typeof EmailConfigSchema>;

/** The optional mailbox operations an EmailProvider may implement. */
export type OptionalEmailOperation = "markAsUnread" | "archiveMessage" | "setStarred" | "moveMessage" | "getDraftByMessageId";

const OPERATION_LABELS: Record<OptionalEmailOperation, string> = {
  markAsUnread: "marking messages unread",
  archiveMessage: "archiving",
  setStarred: "starring",
  moveMessage: "moving messages between mailboxes",
  getDraftByMessageId: "resuming saved drafts",
};

/**
 * Returns an optional provider operation bound to its provider, or throws a
 * readable error when the provider does not implement it.
 */
export function requireEmailOperation<K extends OptionalEmailOperation>(
  provider: EmailProvider,
  operation: K,
  providerName = provider.description,
): NonNullable<EmailProvider[K]> {
  const fn = provider[operation];
  if (typeof fn !== "function") {
    throw new Error(`Email provider "${providerName}" does not support ${OPERATION_LABELS[operation]}`);
  }
  return (fn as (...args: never[]) => unknown).bind(provider) as NonNullable<EmailProvider[K]>;
}

/** Read-only snapshot of an agent's inbox watch (see EmailService.watchEmails). */
export interface EmailWatchStatus {
  /** The agent has a watch configuration. */
  configured: boolean;
  /** The background polling loop is running. */
  running: boolean;
  pollIntervalSeconds: number;
  unreadOnly: boolean;
  markAsRead: boolean;
  actionCount: number;
  /** Messages already handed to the agent by the watch. */
  processedCount: number;
}

export default class EmailService implements TokenRingService {
  readonly name = "EmailService";
  description = "Abstract interface for email inbox and drafting operations";

  private providers = new KeyedRegistry<EmailProvider>();

  registerEmailProvider = this.providers.set;
  unregisterEmailProvider = this.providers.unregister;
  getAvailableProviders = this.providers.keysArray;
  requireEmailProvider = this.providers.require;

  private options: ParsedEmailConfig = EmailConfigSchema.parse({});

  constructor(options?: ParsedEmailConfig) {
    if (options) this.options = options;
  }

  reconfigure(options: ParsedEmailConfig): void {
    this.options = options;
  }

  /** Agent types configured for email processing (from EmailConfigSchema.agentTypes). */
  getAgentTypes(): string[] {
    return [...this.options.agentTypes];
  }

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const agentConfig = deepClone(this.options.agentDefaults, agent.getAgentConfigSlice("email", EmailAgentConfigSchema));
    const initialState = agent.initializeState(EmailState, agentConfig);
    creationContext.items.push(`Email provider: ${initialState.activeProvider ?? "(none)"}`);

    // Background tasks do not survive serialization. If watch config is present or the
    // agent was watching when state was saved, start a fresh watch loop.
    const resumeWatching = initialState.isWatching;
    if (resumeWatching) {
      agent.mutateState(EmailState, state => {
        state.isWatching = false;
      });
    }
    if (agentConfig.watch || resumeWatching) {
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

    agent.runBackgroundTask(async signal => {
      while (!signal.aborted) {
        try {
          const watch = agent.getState(EmailState).watch;
          if (!watch) break;

          await this.checkForNewEmails(watch, agent);
          await delay(this.options.pollInterval, null, { signal });
        } catch (error: unknown) {
          agent.errorMessage(`Error while checking for new emails: ${error as Error}`);
        }
      }
      agent.mutateState(EmailState, state => {
        state.isWatching = false;
      });
    });
  }

  async checkForNewEmails({ unreadOnly, maxEmailsToConsider, actions, markAsRead }: z.output<typeof EmailWatchSchema>, agent: Agent): Promise<void> {
    const provider = this.requireActiveEmailProvider(agent);
    const { messages } = await provider.getMessages({
      box: "inbox",
      limit: maxEmailsToConsider,
      unreadOnly,
    });
    const signal = agent.getAbortSignal();
    const messagesToProcess = agent.mutateState(EmailState, state => {
      const toProcess: EmailMessage[] = [];
      for (const message of messages) {
        if (signal.aborted) break;

        if (!state.processedEmails.has(message.id)) {
          if (!unreadOnly || !message.isRead) {
            toProcess.push(message);
            state.processedEmails.add(message.id);
          }
        }
      }
      return toProcess;
    });

    for (const message of messagesToProcess) {
      if (signal.aborted) break;

      if (message.textBody || message.htmlBody) {
        const body = emailToRFC822(message);
        let matched = false;

        for (const action of actions) {
          const pattern = new RegExp(action.pattern, "is");
          if (pattern.test(body)) {
            matched = true;
            const fromString = combineEmailAddressAndName(message.from);
            agent.mutateState(EmailState, state => {
              state.currentEmail = message;
            });
            agent.handleInput({
              message: action.command,
              from: `Email from ${fromString}`,
              attachments: [
                {
                  name: message.subject,
                  encoding: "text",
                  mimeType: "message/rfc822",
                  body,
                },
              ],
            });
          }
        }

        if (matched && markAsRead) {
          await provider.markAsRead(message.id);
        }
      }
    }
  }

  getWatchStatus(agent: Agent): EmailWatchStatus {
    const state = agent.getState(EmailState);
    return {
      configured: state.watch !== undefined,
      running: state.isWatching,
      pollIntervalSeconds: Math.round(this.options.pollInterval / 1000),
      unreadOnly: state.watch?.unreadOnly ?? false,
      markAsRead: state.watch?.markAsRead ?? false,
      actionCount: state.watch?.actions.length ?? 0,
      processedCount: state.processedEmails.size,
    };
  }

  requireActiveEmailProvider(agent: Agent): EmailProvider {
    const activeProvider = agent.getState(EmailState).activeProvider;
    if (!activeProvider) throw new ConfigurationError(this.name, "No email provider is currently selected");
    return this.providers.require(activeProvider);
  }

  setActiveProvider(name: string, agent: Agent): void {
    agent.mutateState(EmailState, state => {
      state.activeProvider = name;
    });
  }

  getBoxes(agent: Agent): Promise<EmailBox[]> {
    return this.requireActiveEmailProvider(agent).listBoxes();
  }

  getMessages(filter: EmailMessageQueryOptions, agent: Agent): Promise<EmailMessagePage> {
    return this.requireActiveEmailProvider(agent).getMessages({
      ...filter,
      box: filter.box ?? "inbox",
    });
  }

  searchMessages(filter: EmailSearchOptions, agent: Agent): Promise<EmailMessage[]> {
    return this.requireActiveEmailProvider(agent).searchMessages({
      ...filter,
      box: filter.box ?? "inbox",
    });
  }

  getMessageById(id: string, agent: Agent): Promise<EmailMessage> {
    return this.requireActiveEmailProvider(agent).getMessageById(id);
  }

  /**
   * Deletes a message through the active provider (providers move it to trash
   * where they can). Clears the selection when the deleted message was it.
   */
  async deleteMessage(id: string, agent: Agent): Promise<void> {
    await this.requireActiveEmailProvider(agent).deleteMessage(id);
    if (this.getCurrentMessage(agent)?.id === id) {
      this.clearCurrentMessage(agent);
    }
  }

  /** Archives a message through the active provider (it leaves the inbox but stays searchable). */
  async archiveMessage(id: string, agent: Agent): Promise<void> {
    await requireEmailOperation(this.requireActiveEmailProvider(agent), "archiveMessage")(id);
    this.patchCurrentMessage(id, {}, agent, labels => labels.filter(label => label !== "INBOX"));
  }

  /**
   * Moves a message to another mailbox through the active provider. Moving the
   * selected message to the trash clears the selection, as deleting does.
   */
  async moveMessage(id: string, box: string, agent: Agent): Promise<void> {
    await requireEmailOperation(this.requireActiveEmailProvider(agent), "moveMessage")(id, box);
    if (box.trim().toLowerCase() === "trash" && this.getCurrentMessage(agent)?.id === id) {
      this.clearCurrentMessage(agent);
    }
  }

  async setStarred(id: string, starred: boolean, agent: Agent): Promise<void> {
    await requireEmailOperation(this.requireActiveEmailProvider(agent), "setStarred")(id, starred);
    this.patchCurrentMessage(id, { isStarred: starred }, agent);
  }

  async markAsRead(id: string, agent: Agent): Promise<void> {
    await this.requireActiveEmailProvider(agent).markAsRead(id);
    this.patchCurrentMessage(id, { isRead: true }, agent);
  }

  async markAsUnread(id: string, agent: Agent): Promise<void> {
    await requireEmailOperation(this.requireActiveEmailProvider(agent), "markAsUnread")(id);
    this.patchCurrentMessage(id, { isRead: false }, agent);
  }

  /** Keeps the selected message in step with a change made through the provider. */
  private patchCurrentMessage(
    id: string,
    patch: Partial<Pick<EmailMessage, "isRead" | "isStarred">>,
    agent: Agent,
    updateLabels?: (labels: string[]) => string[],
  ): void {
    agent.mutateState(EmailState, state => {
      const current = state.currentEmail;
      if (current?.id !== id) return;
      const next: EmailMessage = { ...current };
      if (patch.isRead !== undefined) next.isRead = patch.isRead;
      if (patch.isStarred !== undefined) next.isStarred = patch.isStarred;
      if (updateLabels && current.labels) next.labels = updateLabels(current.labels);
      state.currentEmail = next;
    });
  }

  async selectMessageById(id: string, agent: Agent): Promise<EmailMessage> {
    const emailMessage = await this.getMessageById(id, agent);
    agent.mutateState(EmailState, state => {
      state.currentEmail = emailMessage;
    });
    return emailMessage;
  }

  getCurrentMessage(agent: Agent): EmailMessage | undefined {
    return agent.getState(EmailState).currentEmail;
  }

  clearCurrentMessage(agent: Agent): void {
    agent.mutateState(EmailState, state => {
      state.currentEmail = undefined;
    });
  }

  async createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft> {
    const draft = await this.requireActiveEmailProvider(agent).createDraft(data);
    agent.mutateState(EmailState, state => {
      state.currentDraft = draft;
    });
    return draft;
  }

  async updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft> {
    const currentDraft = this.getCurrentDraft(agent);
    if (!currentDraft) throw new ConfigurationError(this.name, "No draft is currently selected");

    const newDraft = {
      ...currentDraft,
      ...stripUndefinedKeys(data),
    };
    const draft = await this.requireActiveEmailProvider(agent).updateDraft(newDraft);
    agent.mutateState(EmailState, state => {
      state.currentDraft = draft;
      if (state.lastAttachedDraftId === draft.id) {
        state.lastAttachedDraftId = undefined;
      }
    });
    return draft;
  }

  getCurrentDraft(agent: Agent): EmailDraft | undefined {
    return agent.getState(EmailState).currentDraft;
  }

  clearCurrentDraft(agent: Agent): void {
    agent.mutateState(EmailState, state => {
      state.currentDraft = undefined;
    });
  }

  async sendCurrentDraft(agent: Agent): Promise<EmailDraft> {
    const currentDraft = this.getCurrentDraft(agent);
    if (!currentDraft) throw new ConfigurationError(this.name, "No draft is currently selected");

    await this.requireActiveEmailProvider(agent).sendDraft(currentDraft.id);
    return currentDraft;
  }
}
