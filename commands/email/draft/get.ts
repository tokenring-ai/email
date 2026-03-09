import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

export default {
  name: "email draft get",
  description: "/email draft get - Show current draft",
  help: `# /email draft get

Display the currently selected draft subject.

## Example

/email draft get`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const draft = agent.requireServiceByType(EmailService).getCurrentDraft(agent);
    return draft ? `Current draft: ${draft.subject}` : "No email draft is currently selected.";
  },
} satisfies TokenRingAgentCommand;
