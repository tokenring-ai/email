import { AgentManager } from "@tokenring-ai/agent";
import type TokenRingApp from "@tokenring-ai/app";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import formatError from "@tokenring-ai/utility/error/formatError";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import type { z } from "zod";
import { type EmailProvider, getEmailProviderCapabilities } from "../EmailProvider.ts";
import EmailService, { requireEmailOperation } from "../EmailService.ts";
import { EmailState } from "../state/EmailState.ts";
import EmailRpcSchema, { type EmailMessageActionSchema } from "./schema.ts";

type EmailMessageAction = z.output<typeof EmailMessageActionSchema>;

/** Resolves the provider call for one action, failing up front when the provider lacks it. */
function operationFor(provider: EmailProvider, providerName: string, action: EmailMessageAction): (id: string) => Promise<void> {
  switch (action.type) {
    case "markRead":
      return id => provider.markAsRead(id);
    case "markUnread":
      return requireEmailOperation(provider, "markAsUnread", providerName);
    case "archive":
      return requireEmailOperation(provider, "archiveMessage", providerName);
    case "star": {
      const setStarred = requireEmailOperation(provider, "setStarred", providerName);
      return id => setStarred(id, action.starred);
    }
    case "move": {
      const moveMessage = requireEmailOperation(provider, "moveMessage", providerName);
      return id => moveMessage(id, action.box);
    }
  }
}

const ACTION_VERBS: Record<EmailMessageAction["type"], string> = {
  markRead: "Marked as read",
  markUnread: "Marked as unread",
  archive: "Archived",
  star: "Updated star on",
  move: "Moved",
};

function actionSummary(action: EmailMessageAction, count: number): string {
  const noun = count === 1 ? "message" : "messages";
  if (action.type === "star") return `${action.starred ? "Starred" : "Unstarred"} ${count} ${noun}`;
  if (action.type === "move") return `Moved ${count} ${noun} to ${action.box}`;
  return `${ACTION_VERBS[action.type]} ${count} ${noun}`;
}

export default createRPCEndpoint(EmailRpcSchema, {
  getEmailConfiguration(_args, app: TokenRingApp) {
    const emailService = app.requireService(EmailService);

    return {
      providers: emailService.getAvailableProviders(),
      agentTypes: emailService.getAgentTypes(),
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
    const filter = stripUndefinedKeys({
      query: args.query,
      box: args.box ?? "inbox",
      limit: args.limit,
      unreadOnly: args.unreadOnly,
      pageToken: args.pageToken,
    });
    // Providers without paged search return a single first page (no token).
    const page = provider.searchMessagePage ? await provider.searchMessagePage(filter) : { messages: await provider.searchMessages(filter) };

    return stripUndefinedKeys({
      messages: page.messages,
      count: page.messages.length,
      nextPageToken: "nextPageToken" in page ? page.nextPageToken : undefined,
      message: `Found ${page.messages.length} messages matching "${args.query}"`,
    });
  },

  async markMessageAsRead(args, app: TokenRingApp) {
    const provider = app.requireService(EmailService).requireEmailProvider(args.provider);
    await provider.markAsRead(args.id);
    return { message: "Marked as read" };
  },

  getEmailCapabilities(args, app: TokenRingApp) {
    const provider = app.requireService(EmailService).requireEmailProvider(args.provider);
    return { capabilities: getEmailProviderCapabilities(provider) };
  },

  /**
   * Applies one action to each id. Ids are processed one at a time so a bulk
   * change neither floods the provider nor stops at the first failure.
   */
  async modifyMessages(args, app: TokenRingApp) {
    const provider = app.requireService(EmailService).requireEmailProvider(args.provider);
    const run = operationFor(provider, args.provider, args.action);
    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of args.ids) {
      try {
        await run(id);
        succeeded.push(id);
      } catch (error: unknown) {
        failed.push({ id, error: formatError(error, { includeStack: false }) });
      }
    }
    const summary = actionSummary(args.action, succeeded.length);
    return {
      succeeded,
      failed,
      message: failed.length > 0 ? `${summary}; ${failed.length} failed` : summary,
    };
  },

  /** Creates a server draft, or updates the one named by `id` in place. */
  async saveDraft(args, app: TokenRingApp) {
    const provider = app.requireService(EmailService).requireEmailProvider(args.provider);
    const fields = stripUndefinedKeys({
      subject: args.subject,
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      textBody: args.textBody,
      htmlBody: args.htmlBody,
      threadId: args.threadId,
    });
    if (args.id) {
      const now = Date.now();
      const draft = await provider.updateDraft({ ...fields, id: args.id, createdAt: now, updatedAt: now });
      // An agent holding this draft merges its next edit into its copy and writes the whole draft
      // back; refresh that copy, or the agent would revert what was just saved here.
      for (const agent of app.requireService(AgentManager).getAgents()) {
        let state: EmailState;
        try {
          state = agent.getState(EmailState);
        } catch {
          continue;
        }
        if (state.activeProvider === args.provider && state.currentDraft?.id === draft.id) {
          agent.mutateState(EmailState, next => {
            next.currentDraft = draft;
          });
        }
      }
      return { draft, message: "Draft saved" };
    }
    const draft = await provider.createDraft(fields);
    return { draft, message: "Draft saved" };
  },

  async getDraftForMessage(args, app: TokenRingApp) {
    const provider = app.requireService(EmailService).requireEmailProvider(args.provider);
    const draft = await requireEmailOperation(provider, "getDraftByMessageId", args.provider)(args.messageId);
    return draft ? { draft, message: `Draft: "${draft.subject}"` } : { draft: null, message: "This message is not a saved draft" };
  },

  async sendDraft(args, app: TokenRingApp) {
    const provider = app.requireService(EmailService).requireEmailProvider(args.provider);
    await provider.sendDraft(args.id);
    return { message: "Email sent" };
  },

  getEmailWatchStatus(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    return { status: "success", ...app.requireService(EmailService).getWatchStatus(agent) };
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

  async deleteMessage(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }

    await app.requireService(EmailService).deleteMessage(args.id, agent);

    return {
      status: "success",
      message: `Deleted message: ${args.id}`,
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

    if (args.selectedMessageId !== undefined) {
      if (args.selectedMessageId) {
        await emailService.selectMessageById(args.selectedMessageId, agent);
      } else {
        emailService.clearCurrentMessage(agent);
      }
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
