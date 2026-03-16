import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {EmailState} from "../../../state/EmailState.ts";

export default {
  name: "email provider get",
  description: "Show current provider",
  help: `# /email provider get

Display the currently active email provider.

## Example

/email provider get`,
  execute: async (_remainder: string, agent: Agent): Promise<string> =>
    `Current provider: ${agent.getState(EmailState).activeProvider ?? "(none)"}`,
} satisfies TokenRingAgentCommand;
