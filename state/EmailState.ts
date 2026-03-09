import {Agent} from "@tokenring-ai/agent";
import {AgentStateSlice} from "@tokenring-ai/agent/types";
import {z} from "zod";
import {EmailAgentConfigSchema} from "../schema.ts";

const serializationSchema = z.object({
  activeProvider: z.string().nullable(),
}).prefault({activeProvider: null});

export class EmailState extends AgentStateSlice<typeof serializationSchema> {
  activeProvider: string | null;

  constructor(readonly initialConfig: z.output<typeof EmailAgentConfigSchema>) {
    super("EmailState", serializationSchema);
    this.activeProvider = initialConfig.provider ?? null;
  }

  transferStateFromParent(parent: Agent): void {
    this.activeProvider ??= parent.getState(EmailState).activeProvider;
  }

  serialize(): z.output<typeof serializationSchema> {
    return {activeProvider: this.activeProvider};
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.activeProvider = data.activeProvider;
  }

  show(): string[] {
    return [`Active Email Provider: ${this.activeProvider}`];
  }
}
