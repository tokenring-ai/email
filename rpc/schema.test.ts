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
