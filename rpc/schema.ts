import type {RPCSchema} from "@tokenring-ai/rpc/types";
import {z} from "zod";
import {EmailAddressSchema, EmailBoxSchema, EmailDraftSchema, EmailMessageSchema,} from "../EmailProvider.ts";

export default {
  name: "Email RPC",
  path: "/rpc/email",
  methods: {
    getEmailProviders: {
      type: "query",
      input: z.object({}),
      result: z.object({
        providers: z.array(z.string()),
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
        box: z.string().optional(),
        limit: z.number().int().positive().optional(),
        unreadOnly: z.boolean().optional(),
        pageToken: z.string().optional(),
      }),
      result: z.object({
        messages: z.array(EmailMessageSchema),
        count: z.number(),
        nextPageToken: z.string().optional(),
        message: z.string(),
      }),
    },
    searchMessages: {
      type: "query",
      input: z.object({
        provider: z.string(),
        query: z.string(),
        box: z.string().optional(),
        limit: z.number().int().positive().optional(),
        unreadOnly: z.boolean().optional(),
      }),
      result: z.object({
        messages: z.array(EmailMessageSchema),
        count: z.number(),
        message: z.string(),
      }),
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
    createDraft: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        subject: z.string(),
        to: z.array(EmailAddressSchema),
        cc: z.array(EmailAddressSchema).optional(),
        bcc: z.array(EmailAddressSchema).optional(),
        textBody: z.string().optional(),
        htmlBody: z.string().optional(),
      }),
      result: z.object({
        draft: EmailDraftSchema,
        message: z.string(),
      }),
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
      result: z.object({
        draft: EmailDraftSchema,
        message: z.string(),
      }),
    },
    sendCurrentDraft: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.object({
        draft: EmailDraftSchema,
        message: z.string(),
      }),
    },
    getEmailState: {
      type: "query",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.object({
        selectedMessageId: z.string().nullable(),
        selectedDraftId: z.string().nullable(),
        selectedProvider: z.string().nullable(),
        availableProviders: z.array(z.string()),
      }),
    },
    updateEmailState: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        selectedProvider: z.string().optional(),
        selectedMessageId: z.string().optional(),
      }),
      result: z.object({
        selectedMessageId: z.string().nullable(),
        selectedDraftId: z.string().nullable(),
        selectedProvider: z.string().nullable(),
        availableProviders: z.array(z.string()),
      }),
    },
  },
} satisfies RPCSchema;
