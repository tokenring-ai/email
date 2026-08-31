import { describe, expect, test } from "bun:test";
import type { Agent } from "@tokenring-ai/agent";
import { EmailState } from "./EmailState.ts";

function mockAgentWithState(state: EmailState): Agent {
  return {
    getState(Slice: typeof EmailState) {
      if (Slice !== EmailState) throw new Error("unexpected state slice");
      return state;
    },
  } as unknown as Agent;
}

describe("EmailState.deserialize", () => {
  test("treats missing processedEmails as an empty set", () => {
    const state = new EmailState({});
    state.processedEmails.add("stale");

    expect(() => state.deserialize(state.serializationSchema.parse({}))).not.toThrow();
    expect(state.processedEmails.size).toBe(0);
  });
});

describe("EmailState.transferStateFromParent", () => {
  test("copies processedEmails so child agents do not re-handle messages", () => {
    const parentState = new EmailState({ provider: "gmail" });
    parentState.processedEmails.add("msg-1");
    parentState.processedEmails.add("msg-2");

    const childState = new EmailState({});
    childState.transferStateFromParent(mockAgentWithState(parentState));

    expect(childState.processedEmails.has("msg-1")).toBe(true);
    expect(childState.processedEmails.has("msg-2")).toBe(true);
    childState.processedEmails.add("msg-3");
    expect(parentState.processedEmails.has("msg-3")).toBe(false);
  });

  test("does not overwrite processedEmails the child already has", () => {
    const parentState = new EmailState({});
    parentState.processedEmails.add("parent-msg");

    const childState = new EmailState({});
    childState.processedEmails.add("child-msg");
    childState.transferStateFromParent(mockAgentWithState(parentState));

    expect(childState.processedEmails.has("child-msg")).toBe(true);
    expect(childState.processedEmails.has("parent-msg")).toBe(false);
  });
});

describe("EmailState.show", () => {
  test("does not throw when watch is undefined", () => {
    const state = new EmailState({});

    expect(state.watch).toBeUndefined();
    expect(() => state.show()).not.toThrow();
    expect(state.show()).toContain("No watches configured");
  });
});
