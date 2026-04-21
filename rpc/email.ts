import { AgentManager } from "@tokenring-ai/agent";
import type TokenRingApp from "@tokenring-ai/app";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import EmailService from "../EmailService.ts";
import { EmailState } from "../state/EmailState.ts";
import EmailRpcSchema from "./schema.ts";

export default createRPCEndpoint(EmailRpcSchema, {
  getEmailProviders(_args, app: TokenRingApp) {
    const emailService = app.requireService(EmailService);

    return {
      providers: emailService.getAvailableProviders(),
    };
  },

  async getEmailBoxes(args, app: TokenRingApp) {
    const emailService = app.requireService(EmailService);
    const provider = emailService.requireEmailProvider(args.provider);

    return {
      boxes: await provider.listBoxes(),
    };
  },

  async getMessages(args, app: TokenRingApp) {
    const emailService = app.requireService(EmailService);
    const provider = emailService.requireEmailProvider(args.provider);
    const page = await provider.getMessages(
      stripUndefinedKeys({
        box: args.box ?? "inbox",
        limit: args.limit,
        unreadOnly: args.unreadOnly,
        pageToken: args.pageToken,
      }),
    );

    return stripUndefinedKeys({
      messages: page.messages,
      count: page.messages.length,
      nextPageToken: page.nextPageToken,
      message: `Found ${page.messages.length} messages in ${args.box ?? "inbox"}`,
    });
  },

  async searchMessages(args, app: TokenRingApp) {
    const emailService = app.requireService(EmailService);
    const provider = emailService.requireEmailProvider(args.provider);
    const messages = await provider.searchMessages(
      stripUndefinedKeys({
        query: args.query,
        box: args.box ?? "inbox",
        limit: args.limit,
        unreadOnly: args.unreadOnly,
      }),
    );

    return {
      messages,
      count: messages.length,
      message: `Found ${messages.length} messages matching "${args.query}"`,
    };
  },

  async getMessageById(args, app: TokenRingApp) {
    const emailService = app.requireService(EmailService);
    const provider = emailService.requireEmailProvider(args.provider);
    const email = await provider.getMessageById(args.id);

    return {
      email,
      message: `Message: "${email.subject}"`,
    };
  },

  async createDraft(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }

    const draft = await app.requireService(EmailService).createDraft(
      stripUndefinedKeys({
        subject: args.subject,
        to: args.to,
        cc: args.cc,
        bcc: args.bcc,
        textBody: args.textBody,
        htmlBody: args.htmlBody,
      }),
      agent,
    );

    return {
      status: "success",
      draft,
      message: `Created draft: ${draft.id}`,
    };
  },

  async updateDraft(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }

    const draft = await app.requireService(EmailService).updateDraft(stripUndefinedKeys(args.updatedData), agent);

    return {
      status: "success",
      draft,
      message: `Updated draft: ${draft.id}`,
    };
  },

  async sendCurrentDraft(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }

    const draft = await app.requireService(EmailService).sendCurrentDraft(agent);

    return {
      status: "success",
      draft,
      message: `Sent email: ${draft.id}`,
    };
  },

  getEmailState(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const emailService = app.requireService(EmailService);

    const state = agent.getState(EmailState);

    return {
      status: "success",
      selectedMessageId: state.currentEmail?.id ?? null,
      selectedDraftId: state.currentDraft?.id ?? null,
      selectedProvider: state.activeProvider ?? null,
      availableProviders: emailService.getAvailableProviders(),
    };
  },

  async updateEmailState(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const emailService = app.requireService(EmailService);

    if (args.selectedProvider) {
      emailService.setActiveProvider(args.selectedProvider, agent);
    }

    if (args.selectedMessageId) {
      await emailService.selectMessageById(args.selectedMessageId, agent);
    }

    const state = agent.getState(EmailState);

    return {
      status: "success",
      selectedMessageId: state.currentEmail?.id ?? null,
      selectedDraftId: state.currentDraft?.id ?? null,
      selectedProvider: state.activeProvider ?? null,
      availableProviders: emailService.getAvailableProviders(),
    };
  },
});
