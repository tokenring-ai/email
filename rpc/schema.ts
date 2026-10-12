import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { AgentNotFoundSchema, SuccessSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";
import { EmailAddressSchema, EmailBoxSchema, EmailDraftSchema, EmailMessageSchema, EmailProviderCapabilitiesSchema } from "../EmailProvider.ts";

/** One mailbox change applied to every id passed to `modifyMessages`. */
export const EmailMessageActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("markRead") }),
  z.object({ type: z.literal("markUnread") }),
  z.object({ type: z.literal("archive") }),
  z.object({ type: z.literal("star"), starred: z.boolean() }),
  z.object({ type: z.literal("move"), box: z.string().min(1) }),
]);

const DraftFieldsSchema = z.object({
  subject: z.string(),
  to: z.array(EmailAddressSchema),
  cc: z.array(EmailAddressSchema).exactOptional(),
  bcc: z.array(EmailAddressSchema).exactOptional(),
  textBody: z.string().exactOptional(),
  htmlBody: z.string().exactOptional(),
  threadId: z.string().exactOptional(),
});

export default {
  name: "Email RPC",
  path: "/rpc/email",
  methods: {
    getEmailConfiguration: {
      type: "query",
      input: z.object({}),
      result: z.object({
        providers: z.array(z.string()),
        agentTypes: z.array(z.string()),
      }),
    },
    getEmailBoxes: {
      type: "query",
      input: z.object({
        provider: z.string(),
      }),
      result: z.object({
        boxes: z.array(EmailBoxSchema),
      }),
    },
    getMessages: {
      type: "query",
      input: z.object({
        provider: z.string(),
        box: z.string().exactOptional(),
        limit: z.number().int().positive().exactOptional(),
        unreadOnly: z.boolean().exactOptional(),
        pageToken: z.string().exactOptional(),
      }),
      result: z.object({
        messages: z.array(EmailMessageSchema),
        count: z.number(),
        nextPageToken: z.string().exactOptional(),
        message: z.string(),
      }),
    },
    searchMessages: {
      type: "query",
      input: z.object({
        provider: z.string(),
        query: z.string(),
        box: z.string().exactOptional(),
        limit: z.number().int().positive().exactOptional(),
        unreadOnly: z.boolean().exactOptional(),
        pageToken: z.string().exactOptional(),
      }),
      result: z.object({
        messages: z.array(EmailMessageSchema),
        count: z.number(),
        nextPageToken: z.string().exactOptional(),
        message: z.string(),
      }),
    },
    getEmailCapabilities: {
      type: "query",
      input: z.object({
        provider: z.string(),
      }),
      result: z.object({
        capabilities: EmailProviderCapabilitiesSchema,
      }),
    },
    modifyMessages: {
      type: "mutation",
      input: z.object({
        provider: z.string(),
        ids: z.array(z.string()).min(1),
        action: EmailMessageActionSchema,
      }),
      result: z.object({
        succeeded: z.array(z.string()),
        failed: z.array(z.object({ id: z.string(), error: z.string() })),
        message: z.string(),
      }),
    },
    saveDraft: {
      type: "mutation",
      input: DraftFieldsSchema.extend({
        provider: z.string(),
        /** Existing server draft to update in place; omitted creates a new draft. */
        id: z.string().exactOptional(),
      }),
      result: z.object({
        draft: EmailDraftSchema,
        message: z.string(),
      }),
    },
    getDraftForMessage: {
      type: "query",
      input: z.object({
        provider: z.string(),
        messageId: z.string(),
      }),
      result: z.object({
        draft: EmailDraftSchema.nullable(),
        message: z.string(),
      }),
    },
    sendDraft: {
      type: "mutation",
      input: z.object({
        provider: z.string(),
        id: z.string(),
      }),
      result: z.object({
        message: z.string(),
      }),
    },
    getEmailWatchStatus: {
      type: "query",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          configured: z.boolean(),
          running: z.boolean(),
          pollIntervalSeconds: z.number(),
          unreadOnly: z.boolean(),
          markAsRead: z.boolean(),
          actionCount: z.number(),
          processedCount: z.number(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    getMessageById: {
      type: "query",
      input: z.object({
        provider: z.string(),
        id: z.string(),
      }),
      result: z.object({
        email: EmailMessageSchema,
        message: z.string(),
      }),
    },
    markMessageAsRead: {
      type: "mutation",
      input: z.object({
        provider: z.string(),
        id: z.string(),
      }),
      result: z.object({
        message: z.string(),
      }),
    },
    deleteMessage: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        id: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          message: z.string(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    createDraft: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        subject: z.string(),
        to: z.array(EmailAddressSchema),
        cc: z.array(EmailAddressSchema).exactOptional(),
        bcc: z.array(EmailAddressSchema).exactOptional(),
        textBody: z.string().exactOptional(),
        htmlBody: z.string().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          draft: EmailDraftSchema,
          message: z.string(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    updateDraft: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        updatedData: EmailDraftSchema.omit({
          id: true,
          createdAt: true,
          updatedAt: true,
        }).partial(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          draft: EmailDraftSchema,
          message: z.string(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    sendCurrentDraft: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          draft: EmailDraftSchema,
          message: z.string(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    getEmailState: {
      type: "query",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          selectedMessageId: z.string().nullable(),
          selectedDraftId: z.string().nullable(),
          selectedProvider: z.string().nullable(),
          availableProviders: z.array(z.string()),
        }),
        AgentNotFoundSchema,
      ]),
    },
    updateEmailState: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        selectedProvider: z.string().exactOptional(),
        selectedMessageId: z.string().nullable().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          selectedMessageId: z.string().nullable(),
          selectedDraftId: z.string().nullable(),
          selectedProvider: z.string().nullable(),
          availableProviders: z.array(z.string()),
        }),
        AgentNotFoundSchema,
      ]),
    },
  },
} satisfies RPCSchema;
