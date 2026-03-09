import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

export default {
  name: "email draft clear",
  description: "/email draft clear - Clear current draft selection",
  help: `# /email draft clear

Clear the current email draft selection.

## Example

/email draft clear`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    await agent.requireServiceByType(EmailService).clearCurrentDraft(agent);
    return "Draft cleared. No email draft is currently selected.";
  },
} satisfies TokenRingAgentCommand;
