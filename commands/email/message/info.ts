import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";
import {EmailState} from "../../../state/EmailState.ts";

async function execute(_remainder: string, agent: Agent): Promise<string> {
  const emailService = agent.requireServiceByType(EmailService);
  const currentMessage = emailService.getCurrentMessage(agent);
  if (!currentMessage) return "No email message is currently selected.\nUse /email message select to choose a message.";

  const lines = [
    `Provider: ${agent.getState(EmailState).activeProvider}`,
    `Subject: ${currentMessage.subject}`,
    `From: ${currentMessage.from.name ?? currentMessage.from.email}`,
    `To: ${currentMessage.to.map(address => address.name ?? address.email).join(", ")}`,
    `Received: ${new Date(currentMessage.receivedAt).toLocaleString()}`,
    `Read: ${currentMessage.isRead ? "yes" : "no"}`,
  ];

  if (currentMessage.cc?.length) lines.push(`CC: ${currentMessage.cc.map(address => address.name ?? address.email).join(", ")}`);
  if (currentMessage.labels?.length) lines.push(`Labels: ${currentMessage.labels.join(", ")}`);
  if (currentMessage.snippet) lines.push(`Snippet: ${currentMessage.snippet}`);

  return lines.join("\n");
}

const help = `# /email message info

Display detailed information about the currently selected email message.

## Example

/email message info`;

export default {name: "email message info", description: "Show info about current message", help, execute} satisfies TokenRingAgentCommand;
