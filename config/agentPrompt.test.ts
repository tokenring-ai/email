import { describe, expect, test } from "bun:test";
import tools from "../tools.ts";
import config from "./index.ts";

const prompt = (config as { agents: { email: { chat: { systemPrompt: string } } } }).agents.email.chat.systemPrompt;
const toolNames = tools.map(tool => tool.name);

describe("email agent prompt", () => {
  test("describes the mailbox actions its tools perform", () => {
    expect(toolNames).toEqual(expect.arrayContaining(["email_deleteMessage", "email_archiveMessage", "email_moveMessage", "email_updateMessageFlags"]));
    expect(prompt).toMatch(/archive messages/);
    expect(prompt).toMatch(/move them between mailboxes/);
    expect(prompt).toMatch(/delete them/);
    expect(prompt).toMatch(/ask the user for approval/);
  });

  test("does not promise actions its tools cannot perform", () => {
    expect(toolNames.join(" ")).not.toMatch(/label|purge|emptyTrash/i);
    expect(prompt).toContain("You cannot create or rename labels, empty the trash, or permanently purge mail");
  });
});
