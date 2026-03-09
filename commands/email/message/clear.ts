import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

export default {
  name: "email message clear",
  description: "/email message clear - Clear current message selection",
  help: `# /email message clear

Clear the current email message selection.

## Example

/email message clear`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    await agent.requireServiceByType(EmailService).clearCurrentMessage(agent);
    return "Message cleared. No email message is currently selected.";
  },
} satisfies TokenRingAgentCommand;
