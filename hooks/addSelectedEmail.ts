import { AfterInputReceived } from "@tokenring-ai/agent";
import type Agent from "@tokenring-ai/agent/Agent";
import type { HookSubscription } from "@tokenring-ai/lifecycle/types";
import { HookCallback } from "@tokenring-ai/lifecycle/util/hooks";
import { EmailState } from "../state/EmailState.ts";
import { draftToRFC822, emailToRFC822 } from "../util/emailToRFC822.ts";

const name = "addSelectedEmail";
const displayName = "Email/Add currently selected email to chat";
const description = "Attaches the currently selected email to the chat message";

async function addSelectedEmail(data: AfterInputReceived, agent: Agent) {
  const attachments = (data.input.attachments ??= []);
  agent.mutateState(EmailState, state => {
    if (state.currentEmail && state.lastAttachedEmailId !== state.currentEmail.id) {
      state.lastAttachedEmailId = state.currentEmail.id;
      attachments.push({
        name: state.currentEmail.subject,
        description: "The email below is is the currently selected email.",
        encoding: "text",
        mimeType: "message/rfc822",
        body: emailToRFC822(state.currentEmail),
      });
      state.lastAttachedEmailId = state.currentEmail.id;
    }

    if (state.currentDraft && state.lastAttachedDraftId !== state.currentDraft.id) {
      state.lastAttachedDraftId = state.currentDraft.id;
      attachments.push({
        name: `Draft: ${state.currentDraft.subject || "Untitled"}`,
        description: "The email below is the currently selected draft.",
        encoding: "text",
        mimeType: "message/rfc822",
        body: draftToRFC822(state.currentDraft),
      });
      state.lastAttachedDraftId = state.currentDraft.id;
    }
  });
}

const callbacks = [new HookCallback(AfterInputReceived, addSelectedEmail)];

export default {
  name,
  displayName,
  description,
  callbacks,
} satisfies HookSubscription;
