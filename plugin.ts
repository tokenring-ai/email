import { AgentCommandService } from "@tokenring-ai/agent";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { RpcService } from "@tokenring-ai/rpc";
import { ScriptingService } from "@tokenring-ai/scripting";
import type { ScriptingThis } from "@tokenring-ai/scripting/ScriptingService";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import { z } from "zod";
import commands from "./commands.ts";
import EmailService from "./EmailService.ts";
import { EmailConfigSchema } from "./index.ts";
import packageJSON from "./package.json" with { type: "json" };
import emailRPC from "./rpc/email.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  email: EmailConfigSchema.prefault({}),
});

export default {
  name: packageJSON.name,
  displayName: "Email Service",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    const service = new EmailService(config.email);
    app.services.register(service);

    app.services.waitForItemByType(ScriptingService, (scriptingService: ScriptingService) => {
      scriptingService.registerFunction("getEmailBoxes", {
        type: "native",
        params: [],
        async execute(this: ScriptingThis): Promise<string> {
          const boxes = await this.agent.requireServiceByType(EmailService).getBoxes(this.agent);
          return JSON.stringify(boxes);
        },
      });

      scriptingService.registerFunction("getMessages", {
        type: "native",
        params: ["box", "limit", "pageToken", "unreadOnly"],
        async execute(this: ScriptingThis, box?: string, limit?: string, pageToken?: string, unreadOnly?: string): Promise<string> {
          const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
          const page = await this.agent.requireServiceByType(EmailService).getMessages(
            stripUndefinedKeys({
              box: box?.trim() || undefined,
              limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
              pageToken: pageToken?.trim() || undefined,
              unreadOnly: unreadOnly === undefined ? undefined : unreadOnly.toLowerCase() === "true",
            }),
            this.agent,
          );
          return JSON.stringify(page);
        },
      });

      scriptingService.registerFunction("searchEmailMessages", {
        type: "native",
        params: ["query", "box", "limit", "unreadOnly"],
        async execute(this: ScriptingThis, query: string, box?: string, limit?: string, unreadOnly?: string): Promise<string> {
          const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
          const messages = await this.agent.requireServiceByType(EmailService).searchMessages(
            stripUndefinedKeys({
              query,
              box: box?.trim() || undefined,
              limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
              unreadOnly: unreadOnly === undefined ? undefined : unreadOnly.toLowerCase() === "true",
            }),
            this.agent,
          );
          return JSON.stringify(messages);
        },
      });

      scriptingService.registerFunction("createEmailDraft", {
        type: "native",
        params: ["subject", "bodyText", "toCsv"],
        async execute(this: ScriptingThis, subject: string, bodyText: string, toCsv: string): Promise<string> {
          const to = toCsv
            .split(",")
            .map(email => ({ email: email.trim() }))
            .filter(address => address.email.length > 0);
          const draft = await this.agent.requireServiceByType(EmailService).createDraft({ subject, textBody: bodyText, to }, this.agent);
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

    app.waitForService(ChatService, chatService => chatService.addTools(...tools));
    app.waitForService(AgentCommandService, commandService => commandService.addAgentCommands(commands));

    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(emailRPC);
    });
  },
  config: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
