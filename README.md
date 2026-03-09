# @tokenring-ai/email

## Overview

`@tokenring-ai/email` provides an abstract email layer for Token Ring. It defines a provider interface and shared service/plugin wiring for working with inboxes and outgoing drafts through chat tools, slash commands, and scripting functions.

Key responsibilities:

- Read inbox messages from the active provider
- Search messages by query
- Select a message for follow-up work
- Create and update drafts
- Send the current draft
- Manage provider selection per agent

This package is intended to be extended by concrete integrations such as Gmail, Exchange, IMAP-backed services, or custom internal mail systems.

## Installation

```bash
bun install
```

Typical application usage:

```ts
import EmailPlugin from "@tokenring-ai/email/plugin";
```

## Features

- Provider-based email architecture
- Shared `EmailService` for provider registration and routing
- Agent state for active provider selection
- Chat tools for inbox, search, selection, draft creation, draft updates, and sending
- Slash commands for provider and message/draft workflows
- Scripting functions for inbox reads, search, draft creation, and draft sending

## Core Components

### `EmailService`

Main service class for email operations.

```ts
class EmailService implements TokenRingService {
  registerEmailProvider(name: string, provider: EmailProvider): void;
  getAvailableProviders(): string[];
  setActiveProvider(name: string, agent: Agent): void;
  getInboxMessages(filter: EmailInboxFilterOptions, agent: Agent): Promise<EmailMessage[]>;
  searchMessages(filter: EmailSearchOptions, agent: Agent): Promise<EmailMessage[]>;
  selectMessageById(id: string, agent: Agent): Promise<EmailMessage>;
  getCurrentMessage(agent: Agent): EmailMessage | null;
  clearCurrentMessage(agent: Agent): Promise<void>;
  createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft>;
  updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft>;
  getCurrentDraft(agent: Agent): EmailDraft | null;
  clearCurrentDraft(agent: Agent): Promise<void>;
  sendCurrentDraft(agent: Agent): Promise<SentEmail>;
}
```

### `EmailProvider`

Provider interface implemented by concrete packages.

```ts
interface EmailProvider {
  description: string;
  attach(agent: Agent, creationContext: AgentCreationContext): void;
  getInboxMessages(filter: EmailInboxFilterOptions, agent: Agent): Promise<EmailMessage[]>;
  searchMessages(filter: EmailSearchOptions, agent: Agent): Promise<EmailMessage[]>;
  selectMessageById(id: string, agent: Agent): Promise<EmailMessage>;
  getCurrentMessage(agent: Agent): EmailMessage | null;
  clearCurrentMessage(agent: Agent): Promise<void>;
  createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft>;
  updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft>;
  getCurrentDraft(agent: Agent): EmailDraft | null;
  clearCurrentDraft(agent: Agent): Promise<void>;
  sendCurrentDraft(agent: Agent): Promise<SentEmail>;
}
```

### Key Types

- `EmailMessage`: normalized inbox message shape
- `EmailDraft`: normalized editable draft shape
- `SentEmail`: normalized sent message result
- `EmailInboxFilterOptions`: inbox listing filters
- `EmailSearchOptions`: query-based search filters
- `DraftEmailData` and `UpdateDraftEmailData`: draft input payloads

## Usage Examples

### Plugin Installation

```ts
import TokenRingApp from "@tokenring-ai/app";
import EmailPlugin from "@tokenring-ai/email/plugin";

const app = new TokenRingApp();
app.usePlugin(EmailPlugin, {
  email: {
    agentDefaults: {
      provider: "gmail",
    },
    providers: {
      gmail: {
        type: "gmail",
        description: "Primary inbox",
        account: "primary",
      },
    },
  },
});
```

### Programmatic Service Usage

```ts
import {EmailService} from "@tokenring-ai/email";

const emailService = agent.requireServiceByType(EmailService);

const messages = await emailService.getInboxMessages({limit: 10}, agent);
const draft = await emailService.createDraft({
  subject: "Follow up",
  to: [{email: "alex@example.com"}],
  textBody: "Checking in on the proposal.",
}, agent);

await emailService.sendCurrentDraft(agent);
```

### Example Commands

```text
/email provider select
/email inbox list 10
/email search invoice
/email message select
/email draft get
/email draft send
```

## Configuration

The package is configured under the `email` key.

```ts
{
  email: {
    agentDefaults: {
      provider: "gmail"
    },
    providers: {
      gmail: {
        type: "gmail",
        description: "Primary inbox",
        account: "primary"
      }
    }
  }
}
```

### Schemas

- `EmailAgentConfigSchema`
  - `provider?: string`
- `EmailConfigSchema`
  - `providers: Record<string, unknown>`
  - `agentDefaults: EmailAgentConfig`

## Integration

The plugin registers:

- `EmailService`
- email chat tools from `pkg/email/tools.ts`
- email slash commands from `pkg/email/commands.ts`
- scripting functions:
  - `getInboxMessages(limit?)`
  - `searchEmailMessages(query, limit?)`
  - `createEmailDraft(subject, bodyText, toCsv)`
  - `sendCurrentEmailDraft()`

Concrete provider packages register implementations by calling `EmailService.registerEmailProvider(...)`.

## Chat Commands

Provider commands:

- `/email provider get`
- `/email provider set <name>`
- `/email provider select`
- `/email provider reset`

Inbox and search commands:

- `/email inbox list [limit]`
- `/email search <query>`

Message commands:

- `/email message get`
- `/email message select`
- `/email message info`
- `/email message clear`

Draft commands:

- `/email draft get`
- `/email draft clear`
- `/email draft send`

## State Management

This package maintains agent-scoped provider selection in `EmailState`.

State responsibilities:

- active provider selection
- inheritance of provider choice from parent agents
- provider-agnostic coordination across concrete email implementations

Concrete providers are expected to maintain any provider-specific message or draft selection state on their own slices.

## Dependencies

Key runtime dependencies:

- `@tokenring-ai/agent`
- `@tokenring-ai/app`
- `@tokenring-ai/chat`
- `@tokenring-ai/scripting`
- `@tokenring-ai/utility`
- `zod`

## License

MIT License - see `LICENSE` if present in the package or repository root.
