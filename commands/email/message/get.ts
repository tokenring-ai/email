import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

export default {
  name: "email message get",
  description: "/email message get - Show current message",
  help: `# /email message get

Display the currently selected email message subject.

## Example

/email message get`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const message = agent.requireServiceByType(EmailService).getCurrentMessage(agent);
    return message ? `Current message: ${message.subject}` : "No email message is currently selected.";
  },
} satisfies TokenRingAgentCommand;
