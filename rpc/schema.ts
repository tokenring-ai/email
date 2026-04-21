import { AgentNotFoundSchema } from "@tokenring-ai/agent/schema";
import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";
import { EmailAddressSchema, EmailBoxSchema, EmailDraftSchema, EmailMessageSchema } from "../EmailProvider.ts";

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
        cc: z.array(EmailAddressSchema).exactOptional(),
        bcc: z.array(EmailAddressSchema).exactOptional(),
        textBody: z.string().exactOptional(),
        htmlBody: z.string().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("success"),
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
        z.object({
          status: z.literal("success"),
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
        z.object({
          status: z.literal("success"),
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
        z.object({
          status: z.literal("success"),
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
        selectedMessageId: z.string().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("success"),
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
