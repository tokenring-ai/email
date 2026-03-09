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
  SentEmail,
  UpdateDraftEmailData,
} from "./EmailProvider.ts";
import {EmailConfigSchema, EmailAgentConfigSchema} from "./schema.ts";
import {EmailState} from "./state/EmailState.ts";

export default class EmailService implements TokenRingService {
  readonly name = "EmailService";
  description = "Abstract interface for email inbox and drafting operations";

  private providers = new KeyedRegistry<EmailProvider>();

  registerEmailProvider = this.providers.register;
  getAvailableProviders = this.providers.getAllItemNames;

  constructor(readonly options: z.output<typeof EmailConfigSchema>) {}

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const agentConfig = deepMerge(this.options.agentDefaults, agent.getAgentConfigSlice("email", EmailAgentConfigSchema));
    agent.initializeState(EmailState, agentConfig);
    for (const provider of this.providers.getAllItemValues()) {
      provider?.attach(agent, creationContext);
    }
    creationContext.items.push(`Selected email provider: ${agentConfig.provider ?? "(none)"}`);
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

  async selectMessageById(id: string, agent: Agent): Promise<EmailMessage> {
    return this.requireActiveEmailProvider(agent).selectMessageById(id, agent);
  }

  getCurrentMessage(agent: Agent): EmailMessage | null {
    const activeProvider = agent.getState(EmailState).activeProvider;
    if (!activeProvider) return null;

    const provider = this.providers.getItemByName(activeProvider);
    if (!provider) return null;

    return provider.getCurrentMessage(agent);
  }

  async clearCurrentMessage(agent: Agent): Promise<void> {
    await this.requireActiveEmailProvider(agent).clearCurrentMessage(agent);
  }

  async createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft> {
    return this.requireActiveEmailProvider(agent).createDraft(data, agent);
  }

  async updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft> {
    return this.requireActiveEmailProvider(agent).updateDraft(data, agent);
  }

  getCurrentDraft(agent: Agent): EmailDraft | null {
    const activeProvider = agent.getState(EmailState).activeProvider;
    if (!activeProvider) return null;

    const provider = this.providers.getItemByName(activeProvider);
    if (!provider) return null;

    return provider.getCurrentDraft(agent);
  }

  async clearCurrentDraft(agent: Agent): Promise<void> {
    await this.requireActiveEmailProvider(agent).clearCurrentDraft(agent);
  }

  async sendCurrentDraft(agent: Agent): Promise<SentEmail> {
    return this.requireActiveEmailProvider(agent).sendCurrentDraft(agent);
  }
}
