# @tokenring-ai/email

## Overview

The `@tokenring-ai/email` package provides an abstract email interface for the Token Ring AI ecosystem. It defines a
provider-based architecture for working with email inboxes and outgoing drafts through chat tools, slash commands,
scripting functions, and RPC endpoints.

This package serves as the foundation for email integrations, with concrete implementations (such as Gmail, Exchange,
IMAP-backed services, or custom internal mail systems) extending the provider interface.

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
- **Scripting Functions**: 6 programmatic functions for automation
- **RPC Endpoints**: 10 RPC methods for external integration
- **Email Watching**: Automated monitoring with pattern-based action triggers
- **Type-Safe**: Full TypeScript support with Zod schemas for validation

## Chat Commands

The package registers 14 slash-prefixed commands:

### Provider Commands

#### `/email provider get`

Display the currently active email provider.

**Example**:

```bash
/email provider get
# Output: Current provider: gmail
```

#### `/email provider set <name>`

Set the active email provider by name.

**Example**:

```bash
/email provider set gmail
# Output: Active provider set to: gmail
```

#### `/email provider select`

Interactively select the active email provider. Auto-selects if only one provider is configured.

**Example**:

```bash
/email provider select
# Opens interactive tree selection
```

#### `/email provider reset`

Reset the active email provider to the initial configured value.

**Example**:

```bash
/email provider reset
# Output: Provider reset to gmail
```

### Messages Commands

#### `/email messages list`

List recent messages from a selected email box.

**Options**:

- `--box <box>`: Email box to list from (default: "inbox")
- `--limit <number>`: Optional limit for number of messages (default: 20)
- `--page-token <token>`: Pagination token for retrieving next page

**Example**:

```bash
/email messages list
/email messages list --box sent
/email messages list --limit 10 --page-token <token>
```

#### `/email search <query>`

Search messages from the active email provider.

**Options**:

- `--box <box>`: Email box to search within (default: "inbox")

**Example**:

```bash
/email search invoice
/email search --box sent invoice
/email search "from:alex@example.com project"
```

### Message Commands

#### `/email message get`

Display the currently selected email message subject.

**Example**:

```bash
/email message get
# Output: Current message: Project Update
```

#### `/email message select`

Interactively select an inbox message to inspect.

**Options**:

- `--box <box>`: Email box to browse while selecting (default: "inbox")

**Example**:

```bash
/email message select
/email message select --box sent
```

#### `/email message set --id <id>`

Select an email message by its ID.

**Example**:

```bash
/email message set --id 12345
# Output: Selected message: Project Update
```

#### `/email message info`

Display detailed information about the currently selected email message.

**Example**:

```bash
/email message info
# Output: Provider, Subject, From, To, Received, Read, CC, Labels, Snippet
```

#### `/email message clear`

Clear the current email message selection.

**Example**:

```bash
/email message clear
# Output: Message cleared. No email message is currently selected.
```

### Draft Commands

#### `/email draft get`

Display the currently selected draft subject.

**Example**:

```bash
/email draft get
# Output: Current draft: Follow up
```

#### `/email draft clear`

Clear the current email draft selection.

**Example**:

```bash
/email draft clear
# Output: Draft cleared. No email draft is currently selected.
```

#### `/email draft send`

Send the currently selected email draft.

**Example**:

```bash
/email draft send
# Output: Sent email "Follow up" to alex@example.com
```

## Chat Tools

The package registers 8 tools with the chat system:

### 1. `email_getMessages`

Retrieve messages from a selected email box.

**Parameters**:

- `box` (optional, string): Email box to read from (default: "inbox")
- `limit` (optional, number): Maximum messages to return (default: 25)
- `unreadOnly` (optional, boolean): Filter to unread messages only
- `pageToken` (optional, string): Pagination token for next page

**Returns**: Formatted table of messages with ID, From, Subject, Received, and Read status

**Example**:

```typescript
// Tool call
email_getMessages({ box: "inbox", limit: 10, unreadOnly: true })
```

### 2. `email_searchMessages`

Search messages using the active email provider.

**Parameters**:

- `query` (string): Search query to run against the inbox
- `box` (optional, string): Email box to search within (default: "inbox")
- `limit` (optional, number): Maximum results (default: 25)
- `unreadOnly` (optional, boolean): Filter to unread only

**Returns**: Formatted table of matching messages

**Example**:

```typescript
email_searchMessages({ query: "invoice", box: "inbox", limit: 5 })
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

**Returns**: Current message data as JSON or "No email message is currently selected"

**Example**:

```typescript
email_getCurrentMessage({})
```

### 5. `email_createDraft`

Create a new email draft.

**Parameters**:

- `subject` (string): Email subject line
- `to` (array): Primary recipients (minimum 1), each with `email` and optional `name`
- `cc` (optional, array): CC recipients
- `bcc` (optional, array): BCC recipients
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

**Parameters**: All optional fields:

- `subject` (optional, string): Updated email subject line
- `to` (optional, array): Primary recipients
- `cc` (optional, array): CC recipients
- `bcc` (optional, array): BCC recipients
- `textBody` (optional, string): Updated plain text body
- `htmlBody` (optional, string): Updated HTML body
- `threadId` (optional, string): Optional thread association

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

**Returns**: Current draft as JSON or "No email draft is currently selected"

**Example**:

```typescript
email_getCurrentDraft({})
```

### 8. `email_sendCurrentDraft`

Send the currently selected email draft.

**Parameters**: None

**Returns**: Sent email confirmation as JSON

**Example**:

```typescript
email_sendCurrentDraft({})
```

## Scripting Functions

The package registers 6 scripting functions for programmatic access:

### `getEmailBoxes()`

Retrieve available email boxes from the active provider.

**Parameters**: None

**Returns**: JSON string of boxes array

**Example**:

```typescript
const boxes = await scripting.getEmailBoxes();
const parsed = JSON.parse(boxes);
```

### `getMessages(box?, limit?, pageToken?, unreadOnly?)`

Retrieve messages from a specific box.

**Parameters**:

- `box` (optional, string): Email box to read from
- `limit` (optional, string): Number of messages to retrieve
- `pageToken` (optional, string): Pagination token
- `unreadOnly` (optional, string): "true" for unread only

**Returns**: JSON string of message page

**Example**:

```typescript
const messages = await scripting.getMessages("inbox", "10", undefined, "true");
const parsed = JSON.parse(messages);
```

### `searchEmailMessages(query, box?, limit?, unreadOnly?)`

Search email messages.

**Parameters**:

- `query` (string): Search query
- `box` (optional, string): Email box to search
- `limit` (optional, string): Number of results
- `unreadOnly` (optional, string): "true" for unread only

**Returns**: JSON string of matching messages

**Example**:

```typescript
const results = await scripting.searchEmailMessages("invoice", "inbox", "5");
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

## RPC Endpoints

The package exposes 10 RPC methods at `/rpc/email`:

### Query Methods

#### `getEmailProviders`

Get list of available email providers.

**Input**: `{}`

**Output**: `{ providers: string[] }`

#### `getEmailBoxes`

Get available boxes for a provider.

**Input**: `{ provider: string }`

**Output**: `{ boxes: EmailBox[] }`

#### `getMessages`

Get messages from a provider's box.

**Input**: `{ provider: string, box?: string, limit?: number, unreadOnly?: boolean, pageToken?: string }`

**Output**: `{ messages: EmailMessage[], count: number, nextPageToken?: string, message: string }`

#### `searchMessages`

Search messages in a provider.

**Input**: `{ provider: string, query: string, box?: string, limit?: number, unreadOnly?: boolean }`

**Output**: `{ messages: EmailMessage[], count: number, message: string }`

#### `getMessageById`

Get a specific message by ID.

**Input**: `{ provider: string, id: string }`

**Output**: `{ email: EmailMessage, message: string }`

#### `getEmailState`

Get current email state for an agent.

**Input**: `{ agentId: string }`

**Output**:
`{ status: "success", selectedMessageId: string | null, selectedDraftId: string | null, selectedProvider: string | null, availableProviders: string[] }`

### Mutation Methods

#### `createDraft`

Create a new email draft.

**Input**:
`{ agentId: string, subject: string, to: EmailAddress[], cc?: EmailAddress[], bcc?: EmailAddress[], textBody?: string, htmlBody?: string }`

**Output**: `{ status: "success", draft: EmailDraft, message: string }` or `{ status: "agentNotFound" }`

#### `updateDraft`

Update the current draft.

**Input**: `{ agentId: string, updatedData: Partial<DraftEmailData> }`

**Output**: `{ status: "success", draft: EmailDraft, message: string }` or `{ status: "agentNotFound" }`

#### `sendCurrentDraft`

Send the current draft.

**Input**: `{ agentId: string }`

**Output**: `{ status: "success", draft: EmailDraft, message: string }` or `{ status: "agentNotFound" }`

#### `updateEmailState`

Update email state for an agent.

**Input**: `{ agentId: string, selectedProvider?: string, selectedMessageId?: string }`

**Output**:
`{ status: "success", selectedMessageId: string | null, selectedDraftId: string | null, selectedProvider: string | null, availableProviders: string[] }`
or `{ status: "agentNotFound" }`

## Core Components

### EmailService

The main service class that orchestrates email operations across providers.

**Location**: `pkg/email/EmailService.ts`

**Key Methods**:

```typescript
class EmailService implements TokenRingService {
  readonly name = "EmailService";
  description = "Abstract interface for email inbox and drafting operations";

  // Provider Management
  registerEmailProvider(name: string, provider: EmailProvider): void;
  getAvailableProviders(): string[];
  requireEmailProvider(name: string): EmailProvider;
  setActiveProvider(name: string, agent: Agent): void;

  // Inbox Operations
  getBoxes(agent: Agent): Promise<EmailBox[]>;
  getMessages(filter: EmailMessageQueryOptions, agent: Agent): Promise<EmailMessagePage>;
  searchMessages(filter: EmailSearchOptions, agent: Agent): Promise<EmailMessage[]>;
  getMessageById(id: string, agent: Agent): Promise<EmailMessage>;
  selectMessageById(id: string, agent: Agent): Promise<EmailMessage>;
  getCurrentMessage(agent: Agent): EmailMessage | undefined;
  clearCurrentMessage(agent: Agent): void;

  // Draft Operations
  createDraft(data: DraftEmailData, agent: Agent): Promise<EmailDraft>;
  updateDraft(data: UpdateDraftEmailData, agent: Agent): Promise<EmailDraft>;
  getCurrentDraft(agent: Agent): EmailDraft | undefined;
  clearCurrentDraft(agent: Agent): void;
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

  listBoxes(): Promise<EmailBox[]>;
  getMessages(filter: EmailMessageQueryOptions): Promise<EmailMessagePage>;
  searchMessages(filter: EmailSearchOptions): Promise<EmailMessage[]>;
  getMessageById(id: string): Promise<EmailMessage>;
  createDraft(data: DraftEmailData): Promise<EmailDraft>;
  updateDraft(data: UpdateDraftEmailData): Promise<EmailDraft>;
  sendDraft(id: string): Promise<void>;
}
```

### Key Types

All types are exported from `pkg/email/EmailProvider.ts`:

**`EmailAddress`**: Email address with optional name

```typescript
{ email: string; name?: string }
```

**`EmailMessage`**: Normalized inbox message

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

**`EmailDraft`**: Editable draft structure

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

**`EmailBox`**: Email box/folder

```typescript
{
  id: string;
  name: string;
}
```

**`EmailMessageQueryOptions`**: Message query filters

```typescript
{
  box?: string;
  limit?: number;
  unreadOnly?: boolean;
  pageToken?: string;
}
```

**`EmailMessagePage`**: Paginated message results

```typescript
{
  messages: EmailMessage[];
  nextPageToken?: string;
}
```

**`EmailSearchOptions`**: Search filters

```typescript
{
  query: string;
  box?: string;
  limit?: number;
  unreadOnly?: boolean;
}
```

**`DraftEmailData`**: Draft creation payload

```typescript
Omit<EmailDraft, "id" | "createdAt" | "updatedAt">
```

**`UpdateDraftEmailData`**: Draft update payload

```typescript
Partial<DraftEmailData>
```

## Configuration

The package is configured under the `email` key in the plugin configuration.

### Configuration Schema

```typescript
{
  email: {
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

```yaml
email:
  providers:
    gmail:
      type: "gmail"
      description: "Primary Gmail inbox"
      account: "primary"
    exchange:
      type: "exchange"
      description: "Corporate Exchange"
      server: "exchange.company.com"
  pollInterval: 60
  agentDefaults:
    provider: "gmail"
    watch:
      unreadOnly: true
      maxEmailsToConsider: 25
      actions:
        invoicePattern:
          pattern: "invoice|receipt|payment"
          command: "/research find latest invoice from sender"
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
- `pollInterval`: number (default: 60, transformed to milliseconds)
- `agentDefaults`: EmailAgentConfigSchema (prefaulted)

## State Management

The package maintains agent-scoped state in `EmailState` (`pkg/email/state/EmailState.ts`).

### State Properties

- **`activeProvider`**: Currently selected provider name
- **`currentEmail`**: Currently selected email message
- **`currentDraft`**: Currently selected email draft
- **`watch`**: Email watching configuration
- **`processedEmails`**: Set of processed email IDs (for watching)
- **`isWatching`**: Whether email watching is active
- **`initialConfig`**: Initial configuration from agent config

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
const messages = await emailService.getMessages(
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

  async listBoxes() {
    // Implementation
    return [{ id: "inbox", name: "Inbox" }];
  }

  async getMessages(filter) {
    // Implementation
  }

  async searchMessages(filter) {
    // Implementation
  }

  async getMessageById(id) {
    // Implementation
  }

  async createDraft(data) {
    // Implementation
  }

  async updateDraft(data) {
    // Implementation
  }

  async sendDraft(id) {
    // Implementation
  }
}

// Register with the service
const emailService = app.requireService(EmailService);
emailService.registerEmailProvider("gmail", new GmailProvider());
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

| Package                   | Version | Purpose             |
|---------------------------|---------|---------------------|
| `@tokenring-ai/agent`     | 0.2.0   | Agent orchestration |
| `@tokenring-ai/app`       | 0.2.0   | Service management  |
| `@tokenring-ai/chat`      | 0.2.0   | Chat tools          |
| `@tokenring-ai/rpc`       | 0.2.0   | RPC endpoints       |
| `@tokenring-ai/scripting` | 0.2.0   | Scripting functions |
| `@tokenring-ai/utility`   | 0.2.0   | Utility functions   |
| `zod`                     | ^4.3.6  | Schema validation   |

### Dev Dependencies

| Package      | Version | Purpose       |
|--------------|---------|---------------|
| `typescript` | ^6.0.2  | Type checking |
| `vitest`     | ^4.1.1  | Testing       |

## Related Components

- **`@tokenring-ai/agent`**: Core agent orchestration
- **`@tokenring-ai/chat`**: Chat tools and commands
- **`@tokenring-ai/scripting`**: Scripting function registry
- **`@tokenring-ai/rpc`**: RPC service
- **`@tokenring-ai/app`**: Application framework

## License

MIT License - see `LICENSE` file for details.
