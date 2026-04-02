import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {RpcService} from "@tokenring-ai/rpc";
import {ScriptingService} from "@tokenring-ai/scripting";
import {ScriptingThis} from "@tokenring-ai/scripting/ScriptingService";
import {z} from "zod";
import EmailService from "./EmailService.ts";
import commands from "./commands.ts";
import {EmailConfigSchema} from "./index.ts";
import emailRPC from "./rpc/email.ts";
import packageJSON from "./package.json" with {type: "json"};
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  email: EmailConfigSchema.prefault({}),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    const service = new EmailService(config.email);
    app.services.register(service);

    app.services.waitForItemByType(ScriptingService, (scriptingService: ScriptingService) => {
      scriptingService.registerFunction("getInboxMessages", {
        type: "native",
        params: ["limit"],
        async execute(this: ScriptingThis, limit?: string): Promise<string> {
          const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
          const messages = await this.agent.requireServiceByType(EmailService).getInboxMessages({
            limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
          }, this.agent);
          return JSON.stringify(messages);
        },
      });

      scriptingService.registerFunction("searchEmailMessages", {
        type: "native",
        params: ["query", "limit"],
        async execute(this: ScriptingThis, query: string, limit?: string): Promise<string> {
          const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
          const messages = await this.agent.requireServiceByType(EmailService).searchMessages({
            query,
            limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
          }, this.agent);
          return JSON.stringify(messages);
        },
      });

      scriptingService.registerFunction("createEmailDraft", {
        type: "native",
        params: ["subject", "bodyText", "toCsv"],
        async execute(this: ScriptingThis, subject: string, bodyText: string, toCsv: string): Promise<string> {
          const to = toCsv.split(",").map(email => ({email: email.trim()})).filter(address => address.email.length > 0);
          const draft = await this.agent.requireServiceByType(EmailService).createDraft({subject, textBody: bodyText, to}, this.agent);
          return `Created draft: ${draft.id}`;
        },
      });

      scriptingService.registerFunction("sendCurrentEmailDraft", {
        type: "native",
        params: [],
        async execute(this: ScriptingThis): Promise<string> {
          const sent = await this.agent.requireServiceByType(EmailService).sendCurrentDraft(this.agent);
          return `Sent email: ${sent.id}`;
        },
      });
    });

    app.waitForService(ChatService, chatService => chatService.addTools(tools));
    app.waitForService(AgentCommandService, commandService => commandService.addAgentCommands(commands));

    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(emailRPC);
    });
  },
  config: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
