import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

export default {
  name: "email draft send",
  description: "/email draft send - Send current draft",
  help: `# /email draft send

Send the currently selected email draft.

## Example

/email draft send`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const sent = await agent.requireServiceByType(EmailService).sendCurrentDraft(agent);
    return `Sent email "${sent.subject}" to ${sent.to.map(address => address.name ?? address.email).join(", ")}`;
  },
} satisfies TokenRingAgentCommand;
