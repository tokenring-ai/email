# @tokenring-ai/email

## Overview

The `@tokenring-ai/email` package provides an abstract email interface for the Token Ring AI ecosystem. It defines a provider-based architecture for working with email inboxes and outgoing drafts through chat tools, slash commands, and scripting functions.

This package serves as the foundation for email integrations, with concrete implementations (such as Gmail, Exchange, IMAP-backed services, or custom internal mail systems) extending the provider interface.

### Key Responsibilities

- **Inbox Management**: Read and list inbox messages from the active provider
- **Message Search**: Search messages by query across the inbox
- **Message Selection**: Select specific messages for follow-up work and inspection
- **Draft Management**: Create, update, and manage email drafts
- **Draft Sending**: Send the current draft through the active provider
- **Provider Management**: Select and manage email providers per agent
- **Email Watching**: Configure automated email monitoring with pattern-based actions

## Installation

```bash
bun install
```

The package is automatically included when using the Token Ring plugin system.

## Features

- **Provider-based Architecture**: Pluggable email providers with a unified interface
- **Shared EmailService**: Central service for provider registration and routing
- **Agent State Management**: Persistent provider selection and state per agent
- **Chat Tools**: 8 interactive tools for agent operations
- **Slash Commands**: 14 slash-prefixed commands for CLI-based workflows
- **Scripting Functions**: 4 programmatic functions for automation
- **Email Watching**: Automated monitoring with pattern-based action triggers
- **Type-Safe**: Full TypeScript support with Zod schemas for validation

## Core Components

### EmailService

The main service class that orchestrates email operations across providers.

**Location**: `pkg/email/EmailService.ts`

**Key Methods**:

```typescript
class EmailService implements TokenRingService {
  // Provider Management
  registerEmailProvider(name: string, provider: EmailProvider): void;
  getAvailableProviders(): string[];
  setActiveProvider(name: string, agent: Agent): void;

  // Inbox Operations
  getInboxMessages(filter: EmailInboxFilterOptions, agent: Agent): Promise<EmailMessage[]>;
  searchMessages(filter: EmailSearchOptions, agent: Agent): Promise<EmailMessage[]>;
  getMessageById(id: string, agent: Agent): Promise<EmailMessage>;
  selectMessageById(id: string, agent: Agent): Promise<EmailMessage>;
  getCurrentMessage(agent: Agent): EmailMessage | undefined;
  clearCurrentMessage(agent: Agent): Promise<void>;

  // Draft Operations
  createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft>;
  updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft>;
  getCurrentDraft(agent: Agent): EmailDraft | undefined;
  clearCurrentDraft(agent: Agent): Promise<void>;
  sendCurrentDraft(agent: Agent): Promise<EmailDraft>;

  // Background Tasks
  watchEmails(agent: Agent): void;
  checkForNewEmails(watchConfig: EmailWatchSchema, agent: Agent): Promise<void>;
}
```

### EmailProvider

The provider interface that concrete implementations must follow.

**Location**: `pkg/email/EmailProvider.ts`

```typescript
interface EmailProvider {
  description: string;
  attach?(agent: Agent, creationContext: AgentCreationContext): void;

  // Inbox Operations
  getInboxMessages(filter: EmailInboxFilterOptions, agent: Agent): Promise<EmailMessage[]>;
  searchMessages(filter: EmailSearchOptions, agent: Agent): Promise<EmailMessage[]>;
  getMessageById(id: string, agent: Agent): Promise<EmailMessage>;

  // Draft Operations
  createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft>;
  updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft>;
  sendDraft(id: string, agent: Agent): Promise<void>;
}
```

### Key Types

All types are exported from `pkg/email/EmailProvider.ts`:

- **`EmailAddress`**: Email address with optional name

  ```typescript
  { email: string; name?: string }
  ```

- **`EmailMessage`**: Normalized inbox message

  ```typescript
  {
    id: string;
    threadId?: string;
    subject: string;
    from: EmailAddress;
    to: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
    snippet?: string;
    textBody?: string;
    htmlBody?: string;
    labels?: string[];
    isRead: boolean;
    receivedAt: Date;
    sentAt?: Date;
  }
  ```

- **`EmailDraft`**: Editable draft structure

  ```typescript
  {
    id: string;
    threadId?: string;
    subject: string;
    to: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
    textBody?: string;
    htmlBody?: string;
    createdAt: Date;
    updatedAt: Date;
  }
  ```

- **`EmailInboxFilterOptions`**: Inbox listing filters

  ```typescript
  { limit?: number; unreadOnly?: boolean }
  ```

- **`EmailSearchOptions`**: Search filters

  ```typescript
  { query: string; limit?: number; unreadOnly?: boolean }
  ```

- **`DraftEmailData`**: Draft creation payload (Omit id, createdAt, updatedAt from EmailDraft)

- **`UpdateDraftEmailData`**: Draft update payload (Partial of DraftEmailData)

## Chat Tools

The package registers 8 tools with the chat system:

### 1. `email_getInboxMessages`

Retrieve recent messages from the current inbox.

**Parameters**:

- `limit` (optional, number): Maximum messages to return (default: 25)
- `unreadOnly` (optional, boolean): Filter to unread messages only

**Returns**: Formatted table of messages with ID, From, Subject, Received, and Read status

**Example**:

```typescript
// Tool call
email_getInboxMessages({ limit: 10, unreadOnly: true })
```

### 2. `email_searchMessages`

Search messages using the active email provider.

**Parameters**:

- `query` (string): Search query
- `limit` (optional, number): Maximum results (default: 25)
- `unreadOnly` (optional, boolean): Filter to unread only

**Returns**: Formatted table of matching messages

**Example**:

```typescript
email_searchMessages({ query: "invoice", limit: 5 })
```

### 3. `email_selectMessage`

Select a message by ID for further inspection.

**Parameters**:

- `id` (string): The unique identifier of the email message

**Returns**: Selected message details with subject, from, received date, and JSON representation

**Example**:

```typescript
email_selectMessage({ id: "msg_12345" })
```

### 4. `email_getCurrentMessage`

Retrieve the currently selected email message.

**Parameters**: None

**Returns**: Current message data or "No email message is currently selected"

**Example**:

```typescript
email_getCurrentMessage({})
```

### 5. `email_createDraft`

Create a new email draft.

**Parameters**:

- `subject` (string): Email subject line
- `to` (EmailAddress[]): Primary recipients (minimum 1)
- `cc` (optional, EmailAddress[]): CC recipients
- `bcc` (optional, EmailAddress[]): BCC recipients
- `textBody` (optional, string): Plain text email body
- `htmlBody` (optional, string): HTML email body
- `threadId` (optional, string): Optional thread to associate

**Returns**: Created draft with ID

**Example**:

```typescript
email_createDraft({
  subject: "Follow up",
  to: [{ email: "alex@example.com", name: "Alex" }],
  textBody: "Checking in on the proposal."
})
```

### 6. `email_updateDraft`

Update the currently selected email draft.

**Parameters**: All optional fields from DraftEmailData

**Returns**: Updated draft

**Example**:

```typescript
email_updateDraft({
  subject: "Updated: Follow up",
  textBody: "Following up again on the proposal."
})
```

### 7. `email_getCurrentDraft`

Retrieve the currently selected email draft.

**Parameters**: None

**Returns**: Current draft or "No email draft is currently selected"

**Example**:

```typescript
email_getCurrentDraft({})
```

### 8. `email_sendCurrentDraft`

Send the currently selected email draft.

**Parameters**: None

**Returns**: Sent email confirmation

**Example**:

```typescript
email_sendCurrentDraft({})
```

## Chat Commands

The package registers 14 slash-prefixed commands:

### Provider Commands

#### `/email provider get`

Display the currently active email provider.

**Example**:

```
/email provider get
# Output: Current provider: gmail
```

#### `/email provider set <name>`

Set the active email provider by name.

**Example**:

```
/email provider set gmail
# Output: Active provider set to: gmail
```

#### `/email provider select`

Interactively select the active email provider. Auto-selects if only one provider is configured.

**Example**:

```
/email provider select
# Opens interactive tree selection
```

#### `/email provider reset`

Reset the active email provider to the initial configured value.

**Example**:

```
/email provider reset
# Output: Provider reset to gmail
```

### Inbox Commands

#### `/email inbox list [limit]`

List recent inbox messages from the active provider.

**Options**:

- `--limit <number>`: Optional limit for number of messages (default: 20)

**Example**:

```
/email inbox list
/email inbox list --limit 10
```

#### `/email search <query>`

Search messages from the active email provider.

**Example**:

```
/email search invoice
/email search "from:alex@example.com project"
```

### Message Commands

#### `/email message get`

Display the currently selected email message subject.

**Example**:

```
/email message get
# Output: Current message: Project Update
```

#### `/email message select`

Interactively select an inbox message to inspect.

**Example**:

```
/email message select
# Opens interactive tree selection
```

#### `/email message set --id <id>`

Select an email message by its ID.

**Example**:

```
/email message set --id 12345
# Output: Selected message: Project Update
```

#### `/email message info`

Display detailed information about the currently selected email message.

**Example**:

```
/email message info
# Output: Provider, Subject, From, To, Received, Read, CC, Labels, Snippet
```

#### `/email message clear`

Clear the current email message selection.

**Example**:

```
/email message clear
# Output: Message cleared. No email message is currently selected.
```

### Draft Commands

#### `/email draft get`

Display the currently selected draft subject.

**Example**:

```
/email draft get
# Output: Current draft: Follow up
```

#### `/email draft clear`

Clear the current email draft selection.

**Example**:

```
/email draft clear
# Output: Draft cleared. No email draft is currently selected.
```

#### `/email draft send`

Send the currently selected email draft.

**Example**:

```
/email draft send
# Output: Sent email "Follow up" to alex@example.com
```

## Scripting Functions

The package registers 4 scripting functions for programmatic access:

### `getInboxMessages(limit?)`

Retrieve inbox messages.

**Parameters**:

- `limit` (optional, string): Number of messages to retrieve

**Returns**: JSON string of messages

**Example**:

```typescript
const messages = await scripting.getInboxMessages("10");
const parsed = JSON.parse(messages);
```

### `searchEmailMessages(query, limit?)`

Search email messages.

**Parameters**:

- `query` (string): Search query
- `limit` (optional, string): Number of results

**Returns**: JSON string of matching messages

**Example**:

```typescript
const results = await scripting.searchEmailMessages("invoice", "5");
```

### `createEmailDraft(subject, bodyText, toCsv)`

Create an email draft.

**Parameters**:

- `subject` (string): Email subject
- `bodyText` (string): Email body text
- `toCsv` (string): Comma-separated recipient emails

**Returns**: String with draft ID

**Example**:

```typescript
const result = await scripting.createEmailDraft(
  "Follow up",
  "Checking in on the proposal.",
  "alex@example.com,bob@example.com"
);
// Output: "Created draft: draft_12345"
```

### `sendCurrentEmailDraft()`

Send the current draft.

**Parameters**: None

**Returns**: String with sent email ID

**Example**:

```typescript
const result = await scripting.sendCurrentEmailDraft();
// Output: "Sent email: sent_12345"
```

## Configuration

The package is configured under the `email` key in the plugin configuration.

### Configuration Schema

```typescript
{
  email: {
    // Provider configurations
    providers: {
      [providerName: string]: {
        type: string;
        description: string;
        // Provider-specific options
        [key: string]: unknown;
      }
    },
    
    // Polling interval in seconds (default: 60, transformed to milliseconds)
    pollInterval: number,
    
    // Agent-level defaults
    agentDefaults: {
      // Initial provider selection
      provider?: string,
      
      // Email watching configuration
      watch?: {
        markAsRead: boolean,          // Mark watched emails as read (default: false)
        unreadOnly: boolean,          // Only consider unread emails (default: false)
        maxEmailsToConsider: number,  // Max emails to process per check (default: 50)
        actions: {
          [actionName: string]: {
            pattern: string,          // Regex pattern to match against email body
            command: string           // Command to execute when pattern matches
          }
        }
      }
    }
  }
}
```

### Example Configuration

```typescript
{
  email: {
    providers: {
      gmail: {
        type: "gmail",
        description: "Primary Gmail inbox",
        account: "primary"
      },
      exchange: {
        type: "exchange",
        description: "Corporate Exchange",
        server: "exchange.company.com"
      }
    },
    pollInterval: 60, // 60 seconds
    agentDefaults: {
      provider: "gmail",
      watch: {
        unreadOnly: true,
        maxEmailsToConsider: 25,
        actions: {
          invoicePattern: {
            pattern: "invoice|receipt|payment",
            command: "/research find latest invoice from sender"
          }
        }
      }
    }
  }
}
```

### Configuration Schemas

- **`EmailWatchSchema`**: Watch configuration
  - `markAsRead`: boolean (default: false)
  - `unreadOnly`: boolean (default: false)
  - `maxEmailsToConsider`: number (default: 50)
  - `actions`: Array of { pattern: string, command: string }

- **`EmailAgentConfigSchema`**: Agent-level config
  - `provider`: optional string
  - `watch`: optional EmailWatchSchema

- **`EmailConfigSchema`**: Full package config
  - `providers`: Record<string, unknown> (default: {})
  - `pollInterval`: number (default: 60, transformed to milliseconds)
  - `agentDefaults`: EmailAgentConfigSchema (prefaulted)

## Integration

### Plugin Installation

```typescript
import TokenRingApp from "@tokenring-ai/app";
import EmailPlugin from "@tokenring-ai/email/plugin";

const app = new TokenRingApp();

app.usePlugin(EmailPlugin, {
  email: {
    providers: {
      gmail: {
        type: "gmail",
        description: "Primary Gmail inbox",
        account: "primary"
      }
    },
    agentDefaults: {
      provider: "gmail"
    }
  }
});
```

### Programmatic Service Usage

```typescript
import { EmailService } from "@tokenring-ai/email";

// Get the service from an agent
const emailService = agent.requireServiceByType(EmailService);

// List inbox messages
const messages = await emailService.getInboxMessages(
  { limit: 10, unreadOnly: true },
  agent
);

// Create a draft
const draft = await emailService.createDraft({
  subject: "Follow up",
  to: [{ email: "alex@example.com", name: "Alex" }],
  textBody: "Checking in on the proposal."
}, agent);

// Send the draft
await emailService.sendCurrentDraft(agent);

// Switch providers
emailService.setActiveProvider("exchange", agent);
```

### Provider Registration

Concrete provider packages register implementations with the service:

```typescript
import EmailService from "@tokenring-ai/email/EmailService";

// In provider package
class GmailProvider implements EmailProvider {
  description = "Gmail integration";
  
  async getInboxMessages(filter, agent) {
    // Implementation
  }
  
  // ... other required methods
}

// Register with the service
const emailService = agent.requireServiceByType(EmailService);
emailService.registerEmailProvider("gmail", new GmailProvider());
```

## State Management

The package maintains agent-scoped state in `EmailState` (`pkg/email/state/EmailState.ts`).

### State Properties

- **`activeProvider`**: Currently selected provider name
- **`currentEmail`**: Currently selected email message
- **`currentDraft`**: Currently selected email draft
- **`watch`**: Email watching configuration
- **`processedEmails`**: Set of processed email IDs (for watching)
- **`isWatching`**: Whether email watching is active

### State Lifecycle

1. **Initialization**: State is initialized from agent config during service attachment
2. **Inheritance**: Child agents inherit provider selection from parent agents
3. **Persistence**: State is serialized/deserialized for agent checkpointing
4. **Provider-agnostic**: Base state handles common state; providers manage their-specific state

### State Example

```typescript
import { EmailState } from "@tokenring-ai/email/state/EmailState";

// Get current state
const state = agent.getState(EmailState);
console.log(state.activeProvider); // "gmail"
console.log(state.currentEmail);   // EmailMessage | undefined

// Update state
agent.mutateState(EmailState, state => {
  state.activeProvider = "exchange";
});
```

## Best Practices

### Provider Selection

- Always select a provider before performing email operations
- Use `/email provider select` for interactive selection
- Use `/email provider set <name>` for programmatic selection
- Check `getAvailableProviders()` before setting

### Draft Management

- Create a draft before updating or sending
- Use `getCurrentDraft()` to check current state
- Clear drafts with `clearCurrentDraft()` when done

### Message Handling

- Select messages before inspecting details
- Use `getMessageById()` for direct access
- Clear selections with `clearCurrentMessage()` when finished

### Email Watching

- Configure watching carefully to avoid excessive processing
- Use regex patterns that are specific to your use case
- Monitor the `processedEmails` set to prevent duplicate processing

### Error Handling

- Always handle `No email provider is currently selected` errors
- Check for available providers before operations
- Use try-catch blocks for provider-specific operations

## Testing and Development

### Running Tests

```bash
cd pkg/email
bun test
```

### Watch Mode

```bash
bun test:watch
```

### Coverage

```bash
bun test:coverage
```

### Type Checking

```bash
bun build
```

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@tokenring-ai/agent` | 0.2.0 | Agent orchestration |
| `@tokenring-ai/app` | 0.2.0 | Service management |
| `@tokenring-ai/chat` | 0.2.0 | Chat tools |
| `@tokenring-ai/scripting` | 0.2.0 | Scripting functions |
| `@tokenring-ai/utility` | 0.2.0 | Utility functions |
| `zod` | ^4.3.6 | Schema validation |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^6.0.2 | Type checking |
| `vitest` | ^4.1.1 | Testing |

## Related Components

- **`@tokenring-ai/agent`**: Core agent orchestration
- **`@tokenring-ai/chat`**: Chat tools and commands
- **`@tokenring-ai/scripting`**: Scripting function registry
- **`@tokenring-ai/app`**: Application framework

## License

MIT License - see `LICENSE` file for details.
