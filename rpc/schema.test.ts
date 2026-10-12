import { describe, expect, test } from "bun:test";
import EmailRpcSchema from "./schema.ts";

describe("updateEmailState input", () => {
  test("accepts null selectedMessageId to clear the selection", () => {
    const parsed = EmailRpcSchema.methods.updateEmailState.input.parse({
      agentId: "agent-1",
      selectedMessageId: null,
    });

    expect(parsed.selectedMessageId).toBeNull();
  });

  test("treats omitted selectedMessageId as unchanged", () => {
    const parsed = EmailRpcSchema.methods.updateEmailState.input.parse({
      agentId: "agent-1",
    });

    expect(parsed.selectedMessageId).toBeUndefined();
  });
});

describe("deleteMessage", () => {
  test("requires an agent and a message id", () => {
    const parsed = EmailRpcSchema.methods.deleteMessage.input.parse({ agentId: "agent-1", id: "m1" });

    expect(parsed).toEqual({ agentId: "agent-1", id: "m1" });
    expect(EmailRpcSchema.methods.deleteMessage.type).toBe("mutation");
    expect(() => EmailRpcSchema.methods.deleteMessage.input.parse({ agentId: "agent-1" })).toThrow();
  });

  test("reports success or a missing agent", () => {
    expect(EmailRpcSchema.methods.deleteMessage.result.parse({ status: "success", message: "Deleted message: m1" })).toEqual({
      status: "success",
      message: "Deleted message: m1",
    });
    expect(EmailRpcSchema.methods.deleteMessage.result.parse({ status: "agentNotFound" })).toEqual({ status: "agentNotFound" });
  });
});
