import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import type {TreeLeaf} from "@tokenring-ai/agent/question";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import EmailService from "../../../EmailService.ts";

const inputSchema = {
  args: {},
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const emailService = agent.requireServiceByType(EmailService);

  try {
    const messages = await emailService.getInboxMessages({limit: 25}, agent);
    if (!messages?.length) return "No messages found.";

    const tree: TreeLeaf[] = messages.map(message => ({
      name: `${message.isRead ? " " : "*"} ${message.subject} (${new Date(message.receivedAt).toLocaleDateString()})`,
      value: message.id,
    }));

    const selection = await agent.askQuestion({
      message: "Choose a message to inspect or select nothing to clear the current selection",
      question: {
        type: "treeSelect",
        label: "Email Message Selection",
        key: "result",
        minimumSelections: 1,
        maximumSelections: 1,
        tree,
      },
    });

    if (!selection) return "Message selection cancelled.";
    if (selection.length === 0) {
      await emailService.clearCurrentMessage(agent);
      return "Message selection cleared.";
    }

    const message = await emailService.selectMessageById(selection[0], agent);
    return `Selected message: "${message.subject}"`;
  } catch (error) {
    throw new CommandFailedError(`Error during message selection: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const help = `# /email message select

Interactively select an inbox message to inspect.

## Example

/email message select`;

export default {name: "email message select", description: "Select a message", inputSchema, help, execute} satisfies TokenRingAgentCommand<typeof inputSchema>;
