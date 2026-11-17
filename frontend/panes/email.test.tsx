import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EmailMessage } from "@tokenring-ai/email";
import { defineView } from "@tokenring-ai/one-frontend/layout/define.ts";
import type { ViewParams } from "@tokenring-ai/one-frontend/layout/types.ts";
import { MessageSquare } from "lucide-react";
import type React from "react";
import { SWRConfig } from "swr";

// focus-trap refuses to activate in jsdom.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

// Toasts render through a host the views do not mount; assert on the manager instead.
const toastMocks = { success: mock(), error: mock(), info: mock(), warning: mock(), remove: mock() };
void mock.module("@tokenring-ai/one-frontend/components/ui/toast.tsx", () => ({ toastManager: toastMocks }));

const inboxMessage: EmailMessage = {
  id: "m1",
  threadId: "t1",
  subject: "Launch plan",
  from: { email: "alice@example.com", name: "Alice" },
  to: [{ email: "me@example.com" }],
  snippet: "Here is the plan",
  textBody: "Here is the plan",
  isRead: false,
  receivedAt: Date.parse("2026-06-01T12:00:00Z"),
};

const searchHit: EmailMessage = { ...inboxMessage, id: "m2", subject: "Budget review", snippet: "Numbers inside", textBody: "Numbers inside" };

const secondMessage: EmailMessage = {
  ...inboxMessage,
  id: "m2",
  threadId: "t2",
  subject: "Budget review",
  from: { email: "bob@example.com", name: "Bob" },
  snippet: "Numbers inside",
  textBody: "Numbers inside",
  isRead: false,
};

const emailAgent = {
  id: "agent-1",
  createdAt: 1_700_000_000_000,
  agentType: "email",
  displayName: "Email Agent",
  description: "",
  idle: true,
  currentActivity: "",
};

const createDraft = mock(async (_args: Record<string, unknown>) => ({ status: "success" as const, draft: { id: "d1" }, message: "Draft created" }));
const updateDraft = mock(async (_args: Record<string, unknown>) => ({ status: "success" as const, draft: { id: "d1" }, message: "Draft updated" }));
const sendCurrentDraft = mock(async (_args: { agentId: string }) => ({ status: "success" as const, draft: { id: "d1" }, message: "Email sent" }));
const updateEmailState = mock(async (_args: Record<string, unknown>) => ({ status: "success" as const }));
const deleteMessage = mock(async (_args: { agentId: string; id: string }) => ({ status: "success" as const, message: "Deleted message: m1" }));
const getMessages = mock(async (_args: Record<string, unknown>) => ({ messages: [] as EmailMessage[], count: 0, message: "" }));
const searchMessages = mock(async (_args: Record<string, unknown>) => ({ messages: [] as EmailMessage[], count: 0, message: "" }));
const markMessageAsRead = mock(async (_args: { provider: string; id: string }) => ({ message: "Marked as read" }));
const createAgent = mock(async (_args: { agentType: string }) => ({ id: "agent-new", displayName: "Email Agent", description: "" }));
const sendInput = mock(async (_args: { agentId: string; input: unknown }) => ({ status: "success" as const, requestId: "req-1" }));
const modifyMessages = mock(async (args: { ids: string[]; action: { type: string } }) => ({
  succeeded: args.ids,
  failed: [] as { id: string; error: string }[],
  message: `Done: ${args.action.type}`,
}));
const savedDraft = { id: "d9", subject: "Hi", to: [{ email: "bob@example.com" }], textBody: "Hello there", createdAt: 1, updatedAt: 1 };
const saveDraft = mock(async (_args: Record<string, unknown>) => ({ draft: savedDraft, message: "Draft saved" }));
const sendDraft = mock(async (_args: { provider: string; id: string }) => ({ message: "Email sent" }));
const getDraftForMessage = mock(async (_args: { provider: string; messageId: string }) => ({ draft: savedDraft as typeof savedDraft | null, message: "" }));
const mutateBoxes = mock(async () => undefined);
const mutateMessage = mock(async () => undefined);

const state = {
  providers: ["gmail"] as string[],
  providersError: undefined as unknown,
  boxes: [
    { id: "inbox", name: "Inbox" },
    { id: "sent", name: "Sent" },
  ] as { id: string; name: string }[],
  boxesError: undefined as unknown,
  messages: [inboxMessage] as EmailMessage[],
  agents: [] as (typeof emailAgent)[],
  message: inboxMessage as EmailMessage | null,
  searchNextPageToken: undefined as string | undefined,
  lastSearchQuery: undefined as string | undefined,
  capabilities: { markUnread: true, archive: true, star: true, move: true, resumeDrafts: true } as Record<string, boolean> | undefined,
  watch: undefined as Record<string, unknown> | undefined,
};

void mock.module("@tokenring-ai/one-frontend/rpc.ts", () => ({
  useEmailConfiguration: () => ({
    data: state.providersError ? undefined : { providers: state.providers, agentTypes: ["email"] },
    isLoading: false,
    error: state.providersError,
    mutate: mock(async () => undefined),
  }),
  useEmailBoxes: (provider: string | undefined) => ({
    data: provider && !state.boxesError ? { boxes: state.boxes } : undefined,
    isLoading: false,
    error: state.boxesError,
    mutate: mutateBoxes,
  }),
  useEmailMessages: (provider: string | undefined) => ({
    data: provider ? { messages: state.messages, count: state.messages.length, message: "" } : undefined,
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: mock(async () => undefined),
  }),
  useEmailSearch: (provider: string | undefined, query: string | undefined) => {
    state.lastSearchQuery = query;
    return {
      data:
        provider && query
          ? { messages: [searchHit], count: 1, message: "", ...(state.searchNextPageToken ? { nextPageToken: state.searchNextPageToken } : {}) }
          : undefined,
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: mock(async () => undefined),
    };
  },
  useEmailMessage: (provider: string | undefined, messageId: string | undefined) => ({
    data: provider && messageId && state.message ? { email: state.message, message: "" } : undefined,
    isLoading: false,
    error: undefined,
    mutate: mutateMessage,
  }),
  useTypedSWR: (key: string | null) => {
    let data: unknown;
    if (key?.startsWith("/email/getEmailCapabilities/")) data = state.capabilities ? { capabilities: state.capabilities } : undefined;
    if (key?.startsWith("/email/getEmailWatchStatus/")) data = state.watch;
    return { data, isLoading: false, error: undefined, mutate: mock(async () => undefined) };
  },
  emailRPCClient: {
    createDraft,
    updateDraft,
    sendCurrentDraft,
    updateEmailState,
    getMessages,
    searchMessages,
    markMessageAsRead,
    deleteMessage,
    modifyMessages,
    saveDraft,
    sendDraft,
    getDraftForMessage,
  },
  agentRPCClient: { createAgent, sendInput, deleteAgent: mock(async () => ({ status: "success" as const })) },
  useAgentList: () => ({ data: state.agents, isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useAgentTypes: () => ({ data: [{ type: "email", displayName: "Email Agent", description: "", enabledTools: [] }], isLoading: false }),
}));

const { default: layout } = await import("../layout.ts");
const { default: viewsModule } = await import("../views.tsx");
const { CORE_KINDS } = await import("@tokenring-ai/one-frontend/apps/kinds.ts");
const { createLayoutRegistry } = await import("@tokenring-ai/one-frontend/layout/registry.ts");
const { renderLayoutApp } = await import("@tokenring-ai/one-frontend/test/layout.tsx");
const { resetEmailStore, getComposeState, setEmailBrowserState, startCompose, useEmailBrowserStore } = await import("../lib/emailStore.ts");

function ChatStub() {
  return <p>chat stub</p>;
}

const chatView = defineView({
  id: "chat",
  kind: "agent",
  title: params => params.agentId ?? "Chat",
  icon: MessageSquare,
  route: "agent/:agentId",
  instanceKey: params => params.agentId ?? "",
  component: ChatStub,
});

const registry = createLayoutRegistry({ apps: layout.apps, views: [...viewsModule.views, chatView], kinds: [...CORE_KINDS, ...layout.kinds] });

// A fresh SWR cache per render, so mocked hooks and SWR-backed ones never share state across tests.
function FreshSwr({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

let current: ReturnType<typeof renderLayoutApp> | null = null;

/** The whole Email app at a URL. */
function renderEmailApp(url = "/email/gmail") {
  current = renderLayoutApp({ registry, url, wrapper: FreshSwr });
  return current;
}

/** The app at the URL of one of its tab views. */
function renderPane(viewId: string, params: ViewParams = {}) {
  return renderEmailApp(registry.routes.urlFor("email", viewId, params) ?? "/email");
}

/** A tab of the view is open (panel keys are `<viewId>:<instanceKey>`). */
const isOpen = (viewId: string) => document.querySelector(`[data-panel^="${viewId}:"]`) !== null;
const pathname = () => current?.location().pathname;
const dirtyDraft = (body: string) => ({ mode: "compose" as const, to: "", cc: "", bcc: "", subject: "", body });

describe("Email app", () => {
  beforeEach(() => {
    localStorage.clear();
    resetEmailStore();
    for (const fn of [
      createDraft,
      updateDraft,
      sendCurrentDraft,
      updateEmailState,
      getMessages,
      createAgent,
      sendInput,
      mutateBoxes,
      mutateMessage,
      deleteMessage,
      searchMessages,
      markMessageAsRead,
      modifyMessages,
      saveDraft,
      sendDraft,
      getDraftForMessage,
    ]) {
      fn.mockClear();
    }
    for (const fn of Object.values(toastMocks)) fn.mockClear();
    state.providers = ["gmail"];
    state.providersError = undefined;
    state.boxes = [
      { id: "inbox", name: "Inbox" },
      { id: "sent", name: "Sent" },
    ];
    state.boxesError = undefined;
    state.messages = [inboxMessage];
    state.agents = [];
    state.message = inboxMessage;
    state.searchNextPageToken = undefined;
    state.lastSearchQuery = undefined;
    state.capabilities = { markUnread: true, archive: true, star: true, move: true, resumeDrafts: true };
    state.watch = undefined;
  });

  describe("navigator", () => {
    it("lists the inbox and opens a message in the main area", async () => {
      const user = userEvent.setup();
      renderEmailApp();

      expect(await screen.findByText("Launch plan")).toBeInTheDocument();
      await user.click(screen.getByText("Launch plan"));

      expect(pathname()).toBe("/email/gmail/inbox/m1");
      // The "Select a message" placeholder has done its job.
      expect(isOpen("email-start")).toBe(false);
      expect(isOpen("email-message")).toBe(true);
    });

    it("does not open a message when its checkbox is clicked", async () => {
      const user = userEvent.setup();
      renderEmailApp();

      const checkbox = await screen.findByRole("checkbox", { name: /Launch plan/ });
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
      expect(isOpen("email-message")).toBe(false);
      expect(pathname()).toBe("/email/gmail");

      await user.click(screen.getByText("Launch plan"));
      expect(pathname()).toBe("/email/gmail/inbox/m1");
      // The "Select a message" placeholder has done its job.
      expect(isOpen("email-start")).toBe(false);
      expect(isOpen("email-message")).toBe(true);
    });

    it("selects every message on the page and archives them in one call", async () => {
      const user = userEvent.setup();
      state.messages = [inboxMessage, secondMessage];
      renderEmailApp();

      await user.click(await screen.findByRole("checkbox", { name: "Select all on this page" }));

      expect(screen.getByRole("checkbox", { name: /Launch plan/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /Budget review/ })).toBeChecked();

      await user.click(screen.getByRole("button", { name: "Archive" }));

      await waitFor(() => expect(modifyMessages).toHaveBeenCalledWith({ provider: "gmail", ids: ["m1", "m2"], action: { type: "archive" } }));
      expect(modifyMessages).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.getByRole("checkbox", { name: /Launch plan/ })).not.toBeChecked());
      expect(screen.getByRole("checkbox", { name: /Budget review/ })).not.toBeChecked();
    });

    it("toasts a failed bulk change and keeps the failed messages selected", async () => {
      const user = userEvent.setup();
      state.messages = [inboxMessage, secondMessage];
      modifyMessages.mockImplementationOnce(async args => ({
        succeeded: args.ids.filter(id => id !== "m2"),
        failed: [{ id: "m2", error: "quota" }],
        message: "",
      }));
      renderEmailApp();

      await user.click(await screen.findByRole("checkbox", { name: "Select all on this page" }));
      await user.click(screen.getByRole("button", { name: "Archive" }));

      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("quota", { duration: 5000 }));
      expect(screen.getByRole("checkbox", { name: /Budget review/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /Launch plan/ })).not.toBeChecked();
      expect(modifyMessages).toHaveBeenCalledTimes(1);
    });

    it("asks Gmail for read mail instead of hiding unread rows on the loaded page", async () => {
      const user = userEvent.setup();
      state.messages = [inboxMessage, { ...secondMessage, isRead: true }];
      renderEmailApp();

      expect(await screen.findByText("Bob")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Read" }));

      await waitFor(() => expect(state.lastSearchQuery).toBe("is:read"));
      // The read row from the previous page is not reused; the list is the search result.
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });

    it("clears the selection when the filter changes", async () => {
      const user = userEvent.setup();
      state.messages = [inboxMessage, secondMessage];
      renderEmailApp();

      await user.click(await screen.findByRole("checkbox", { name: "Select all on this page" }));
      expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Unread" }));

      expect(screen.getByRole("checkbox", { name: /Launch plan/ })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: /Budget review/ })).not.toBeChecked();
      expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    });

    it("starts on the placeholder tab", async () => {
      renderEmailApp("/email/gmail");
      expect(await screen.findByText("Launch plan")).toBeInTheDocument();
      expect(isOpen("email-start")).toBe(true);
      expect(screen.getByText("Pick a message from the list to read it here, or compose a new email.")).toBeInTheDocument();
    });

    it("redirects /email to the first configured provider", async () => {
      renderEmailApp("/email");
      await waitFor(() => expect(pathname()).toBe("/email/gmail"));
    });

    it("searches messages and clears the search again", async () => {
      const user = userEvent.setup();
      renderEmailApp();

      await user.type(await screen.findByLabelText("Search emails"), "budget{Enter}");
      expect(await screen.findByText("Budget review")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear" }));
      expect(await screen.findByText("Launch plan")).toBeInTheDocument();
    });

    it("empties the search box when the search is cleared by switching mailbox", async () => {
      const user = userEvent.setup();
      renderEmailApp();

      const box = await screen.findByLabelText("Search emails");
      await user.type(box, "budget{Enter}");
      expect(await screen.findByText("Budget review")).toBeInTheDocument();

      act(() => setEmailBrowserState({ box: "sent", searchQuery: null }));
      await waitFor(() => expect(screen.getByLabelText("Search emails")).toHaveValue(""));
    });

    it("starts a draft and opens the compose panel", async () => {
      const user = userEvent.setup();
      renderEmailApp();

      await user.click(await screen.findByRole("button", { name: /Compose/ }));
      expect(isOpen("email-compose")).toBe(true);
      expect(pathname()).toBe("/email/gmail/compose");
      expect(getComposeState()).toMatchObject({ provider: "gmail", draft: { mode: "compose" } });
    });

    it("keeps a mailbox picked while a message from another box is open", async () => {
      const store = renderHook(() => useEmailBrowserStore());
      renderEmailApp("/email/gmail/inbox/m1");
      await waitFor(() => expect(store.result.current.box).toBe("inbox"));

      act(() => setEmailBrowserState({ box: "sent", searchQuery: null }));
      // Re-renders must not snap the selection back to the routed box.
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(store.result.current.box).toBe("sent");
    });

    it("resumes an unsent draft instead of replacing it", async () => {
      const user = userEvent.setup();
      startCompose("gmail", dirtyDraft("Half a thought"));
      renderEmailApp();

      await user.click(await screen.findByRole("button", { name: /Compose/ }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(pathname()).toBe("/email/gmail/compose");
      expect(getComposeState()?.draft.body).toBe("Half a thought");
    });

    it("tells the user no account is connected and offers the guided Google setup", async () => {
      const user = userEvent.setup();
      state.providers = [];
      renderEmailApp("/email");
      expect(await screen.findByText("No account connected")).toBeInTheDocument();
      expect(screen.getAllByText(/Google/).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /Compose/ })).toHaveAttribute("title", expect.stringContaining("Configure an email provider"));

      await user.click(screen.getByRole("button", { name: "Connect Google" }));
      expect(pathname()).toBe("/configuration/connect-google");
    });

    it("pages search results with the search's page token", async () => {
      const user = userEvent.setup();
      state.searchNextPageToken = "search-2";
      searchMessages.mockImplementationOnce(async () => ({ messages: [{ ...searchHit, id: "m3", subject: "Budget follow-up" }], count: 1, message: "" }));
      renderEmailApp();

      await user.type(await screen.findByLabelText("Search emails"), "budget{Enter}");
      expect(await screen.findByText("1+ results")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Load more" }));

      expect(await screen.findByText("Budget follow-up")).toBeInTheDocument();
      expect(searchMessages.mock.calls[0]![0]).toMatchObject({ provider: "gmail", query: "budget", pageToken: "search-2" });
      expect(getMessages).not.toHaveBeenCalled();
    });

    it("lists the app's agents and opens the attached agent's chat beside the messages", async () => {
      state.agents = [emailAgent];
      localStorage.setItem("agentSession:email", "agent-1");
      renderEmailApp();
      expect(await screen.findByText("Email agents")).toBeInTheDocument();
      expect(await screen.findByText("chat stub")).toBeInTheDocument();
    });

    it("shows the attached agent's inbox watch status, read-only", async () => {
      state.agents = [emailAgent];
      state.watch = {
        status: "success",
        configured: true,
        running: true,
        pollIntervalSeconds: 60,
        unreadOnly: true,
        markAsRead: false,
        actionCount: 2,
        processedCount: 5,
      };
      localStorage.setItem("agentSession:email", "agent-1");
      renderEmailApp("/email/gmail");

      const row = await screen.findByTestId("email-watch-status");
      expect(within(row).getByText("Watching")).toBeInTheDocument();
      expect(within(row).getByText(/every 60s · 2 actions/)).toBeInTheDocument();
      expect(row.getAttribute("title")).toContain("unread mail only");
    });

    it("says when the agent has no inbox watch", async () => {
      state.agents = [emailAgent];
      state.watch = {
        status: "success",
        configured: false,
        running: false,
        pollIntervalSeconds: 60,
        unreadOnly: false,
        markAsRead: false,
        actionCount: 0,
        processedCount: 0,
      };
      localStorage.setItem("agentSession:email", "agent-1");
      renderEmailApp();

      expect(within(await screen.findByTestId("email-watch-status")).getByText("Not configured")).toBeInTheDocument();
    });
  });

  describe("message", () => {
    it("renders the message and titles its tab", async () => {
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      expect((await screen.findAllByText("Here is the plan")).length).toBeGreaterThan(0);
      await waitFor(() => expect(document.title).toBe("Launch plan · Email"));
    });

    it("prefills a reply and opens the compose panel", async () => {
      const user = userEvent.setup();
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: /^Reply$/ }));
      expect(isOpen("email-compose")).toBe(true);
      expect(pathname()).toBe("/email/gmail/compose");
      expect(getComposeState()?.draft).toMatchObject({ mode: "reply", to: "Alice <alice@example.com>", subject: "Re: Launch plan" });
    });

    it("asks before a reply replaces an unsent draft", async () => {
      const user = userEvent.setup();
      startCompose("gmail", dirtyDraft("Half a thought"));
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: /^Reply$/ }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep draft" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(getComposeState()?.draft).toMatchObject({ mode: "compose", body: "Half a thought" });
      expect(isOpen("email-compose")).toBe(false);

      await user.click(screen.getByRole("button", { name: /^Reply$/ }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard draft" }));
      await waitFor(() => expect(getComposeState()?.draft).toMatchObject({ mode: "reply", subject: "Re: Launch plan" }));
      expect(pathname()).toBe("/email/gmail/compose");
    });

    it("hands the message to the attached agent", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: /Reply with AI/ }));
      await waitFor(() => expect(sendInput).toHaveBeenCalled());
      expect(sendInput.mock.calls[0]![0]).toMatchObject({ agentId: "agent-1", input: { from: "Email App" } });
    });

    it("deletes the message after confirmation, then closes the panel and refreshes the list", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      const store = renderHook(() => useEmailBrowserStore());
      const before = store.result.current.listRefreshKey;
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: /^Delete$/ }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteMessage).toHaveBeenCalledWith({ agentId: "agent-1", id: "m1" }));
      expect(toastMocks.success).toHaveBeenCalledWith("Deleted message: m1", { duration: 2500 });
      await waitFor(() => expect(isOpen("email-message")).toBe(false));
      // The navigator list revalidates so the deleted row disappears.
      await waitFor(() => expect(store.result.current.listRefreshKey).toBe(before + 1));
    });

    it("keeps the message when the confirmation is cancelled", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: /^Delete$/ }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(deleteMessage).not.toHaveBeenCalled();
      expect(isOpen("email-message")).toBe(true);
    });

    it("toasts and keeps the panel open when the delete fails", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      deleteMessage.mockImplementationOnce(async () => {
        throw new Error("Gmail said no");
      });
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: /^Delete$/ }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(toastMocks.error).toHaveBeenCalled());
      expect(toastMocks.error.mock.calls[0]![0]).toContain("Gmail said no");
      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(isOpen("email-message")).toBe(true);
    });

    it("marks an unread message as read and refreshes the list", async () => {
      const user = userEvent.setup();
      const store = renderHook(() => useEmailBrowserStore());
      const before = store.result.current.listRefreshKey;
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: "Mark as read" }));
      await waitFor(() => expect(markMessageAsRead).toHaveBeenCalledWith({ provider: "gmail", id: "m1" }));
      expect(mutateMessage).toHaveBeenCalled();
      await waitFor(() => expect(store.result.current.listRefreshKey).toBe(before + 1));
    });

    it("offers no mark-as-read for a message already read", async () => {
      state.message = { ...inboxMessage, isRead: true };
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });
      expect((await screen.findAllByText("Launch plan")).length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
    });

    it("archives the message, then closes the panel and refreshes the list", async () => {
      const user = userEvent.setup();
      const store = renderHook(() => useEmailBrowserStore());
      const before = store.result.current.listRefreshKey;
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: "Archive" }));
      await waitFor(() => expect(modifyMessages).toHaveBeenCalledWith({ provider: "gmail", ids: ["m1"], action: { type: "archive" } }));
      await waitFor(() => expect(isOpen("email-message")).toBe(false));
      expect(store.result.current.listRefreshKey).toBe(before + 1);
    });

    it("stars and marks unread in place", async () => {
      const user = userEvent.setup();
      state.message = { ...inboxMessage, isRead: true, isStarred: false };
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: "Star" }));
      await waitFor(() => expect(modifyMessages).toHaveBeenCalledWith({ provider: "gmail", ids: ["m1"], action: { type: "star", starred: true } }));
      await user.click(screen.getByRole("button", { name: "Mark unread" }));
      await waitFor(() => expect(modifyMessages).toHaveBeenLastCalledWith({ provider: "gmail", ids: ["m1"], action: { type: "markUnread" } }));
      expect(mutateMessage).toHaveBeenCalled();
      expect(isOpen("email-message")).toBe(true);
    });

    it("moves the message to another mailbox", async () => {
      const user = userEvent.setup();
      state.boxes = [
        { id: "inbox", name: "Inbox" },
        { id: "sent", name: "Sent" },
        { id: "spam", name: "Spam" },
      ];
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: /Move to/ }));
      // Sent is a view, and the message is already in the inbox.
      expect(screen.queryByRole("menuitem", { name: /Sent/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /Inbox/ })).not.toBeInTheDocument();
      await user.click(await screen.findByRole("menuitem", { name: /Spam/ }));

      await waitFor(() => expect(modifyMessages).toHaveBeenCalledWith({ provider: "gmail", ids: ["m1"], action: { type: "move", box: "spam" } }));
      await waitFor(() => expect(isOpen("email-message")).toBe(false));
    });

    it("hides mailbox actions the provider does not support", async () => {
      state.capabilities = { markUnread: false, archive: false, star: false, move: false, resumeDrafts: false };
      state.message = { ...inboxMessage, isRead: true };
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      expect((await screen.findAllByText("Launch plan")).length).toBeGreaterThan(0);
      for (const name of ["Archive", "Star", "Mark unread", /Move to/]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
    });

    it("toasts a failed mailbox change and keeps the panel", async () => {
      const user = userEvent.setup();
      modifyMessages.mockImplementationOnce(async args => ({ succeeded: [], failed: [{ id: args.ids[0]!, error: "quota" }], message: "" }));
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: "Archive" }));
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("quota", { duration: 5000 }));
      expect(isOpen("email-message")).toBe(true);
    });

    it("resumes a message from the Drafts box as its saved draft", async () => {
      const user = userEvent.setup();
      renderPane("email-message", { provider: "gmail", box: "drafts", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: "Edit draft" }));
      await waitFor(() => expect(getDraftForMessage).toHaveBeenCalledWith({ provider: "gmail", messageId: "m1" }));
      await waitFor(() => expect(getComposeState()?.draft).toMatchObject({ serverDraftId: "d9", to: "bob@example.com", subject: "Hi", body: "Hello there" }));
      expect(pathname()).toBe("/email/gmail/compose");
    });

    it("offers Edit draft only in the Drafts box", async () => {
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });
      expect((await screen.findAllByText("Launch plan")).length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: "Edit draft" })).not.toBeInTheDocument();
    });

    it("closes its own panel", async () => {
      const user = userEvent.setup();
      renderPane("email-message", { provider: "gmail", box: "inbox", messageId: "m1" });

      await user.click(await screen.findByRole("button", { name: "Close email" }));
      expect(isOpen("email-message")).toBe(false);
    });
  });

  describe("compose", () => {
    it("starts an empty draft from a deep link and keeps it when the panel is closed", async () => {
      const user = userEvent.setup();
      const first = renderPane("email-compose", { provider: "gmail" });

      await user.type(await first.findByLabelText("Message body"), "Half a thought");
      await waitFor(() => expect(screen.getAllByRole("img", { name: "Unsent draft" }).length).toBeGreaterThan(0));
      first.unmount();

      renderPane("email-compose", { provider: "gmail" });
      expect(await screen.findByLabelText("Message body")).toHaveValue("Half a thought");
    });

    it("composes through the provider in the URL, replacing an untouched draft for another one", async () => {
      startCompose("outlook");
      renderPane("email-compose", { provider: "gmail" });
      await waitFor(() => expect(getComposeState()?.provider).toBe("gmail"));
    });

    it("asks before a deep link replaces an unsent draft for another provider", async () => {
      const user = userEvent.setup();
      startCompose("outlook", dirtyDraft("Keep me"));
      renderPane("email-compose", { provider: "gmail" });

      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep draft" }));
      // Keeping it points the URL back at the draft's provider.
      await waitFor(() => expect(pathname()).toBe("/email/outlook/compose"));
      expect(getComposeState()).toMatchObject({ provider: "outlook", draft: { body: "Keep me" } });
    });

    it("starts a draft for the URL's provider once the user discards the other one", async () => {
      const user = userEvent.setup();
      startCompose("outlook", dirtyDraft("Throw away"));
      renderPane("email-compose", { provider: "gmail" });

      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard draft" }));
      await waitFor(() => expect(getComposeState()).toMatchObject({ provider: "gmail", draft: { body: "" } }));
      expect(pathname()).toBe("/email/gmail/compose");
    });

    it("sends the draft and closes the panel", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      startCompose("gmail", { mode: "compose", to: "bob@example.com", cc: "", bcc: "", subject: "Hi", body: "Hello there" });
      renderPane("email-compose", { provider: "gmail" });

      await user.click(await screen.findByRole("button", { name: /Send/ }));

      await waitFor(() => expect(createDraft).toHaveBeenCalled());
      expect(createDraft.mock.calls[0]![0]).toMatchObject({ agentId: "agent-1", subject: "Hi", to: [{ email: "bob@example.com" }] });
      await waitFor(() => expect(sendCurrentDraft).toHaveBeenCalledWith({ agentId: "agent-1" }));
      await waitFor(() => expect(isOpen("email-compose")).toBe(false));
      expect(getComposeState()).toBeNull();
    });

    it("saves the draft to the provider, then updates it in place and closes without asking", async () => {
      const user = userEvent.setup();
      startCompose("gmail", { mode: "compose", to: "bob@example.com", cc: "", bcc: "", subject: "Hi", body: "Hello there" });
      renderPane("email-compose", { provider: "gmail" });

      await user.click(await screen.findByRole("button", { name: /Save draft/ }));
      await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
      expect(saveDraft.mock.calls[0]![0]).toEqual({ provider: "gmail", subject: "Hi", to: [{ email: "bob@example.com" }], textBody: "Hello there" });
      await waitFor(() => expect(getComposeState()?.draft.serverDraftId).toBe("d9"));
      expect(await screen.findByText("Saved in Drafts")).toBeInTheDocument();

      await user.type(screen.getByLabelText("Message body"), "!");
      expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Save draft/ }));
      await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2));
      expect(saveDraft.mock.calls[1]![0]).toMatchObject({ id: "d9", textBody: "Hello there!" });

      // Saved and unchanged: closing loses nothing, so it does not ask.
      await user.click(screen.getByRole("button", { name: "Close compose" }));
      await waitFor(() => expect(isOpen("email-compose")).toBe(false));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("keeps text typed while a save is in flight marked as unsaved", async () => {
      const user = userEvent.setup();
      let release!: () => void;
      saveDraft.mockImplementationOnce(async () => {
        await new Promise<void>(resolve => (release = resolve));
        return { draft: savedDraft, message: "Draft saved" };
      });
      startCompose("gmail", { mode: "compose", to: "bob@example.com", cc: "", bcc: "", subject: "Hi", body: "Hello there" });
      renderPane("email-compose", { provider: "gmail" });

      await user.click(await screen.findByRole("button", { name: /Save draft/ }));
      await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
      await user.type(screen.getByLabelText("Message body"), " and more");
      release();

      await waitFor(() => expect(getComposeState()?.draft.serverDraftId).toBe("d9"));
      expect(getComposeState()?.saved?.body).toBe("Hello there");
      expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
    });

    it("sends a saved draft in place instead of creating another", async () => {
      const user = userEvent.setup();
      startCompose("gmail", { mode: "compose", to: "bob@example.com", cc: "", bcc: "", subject: "Hi", body: "Hello there", serverDraftId: "d9" });
      renderPane("email-compose", { provider: "gmail" });

      await user.click(await screen.findByRole("button", { name: /Send/ }));
      await waitFor(() => expect(sendDraft).toHaveBeenCalledWith({ provider: "gmail", id: "d9" }));
      expect(saveDraft.mock.calls[0]![0]).toMatchObject({ id: "d9" });
      expect(createDraft).not.toHaveBeenCalled();
      await waitFor(() => expect(isOpen("email-compose")).toBe(false));
    });

    it("asks before Cancel discards an unsent draft", async () => {
      const user = userEvent.setup();
      startCompose("gmail", dirtyDraft("Half a thought"));
      renderPane("email-compose", { provider: "gmail" });

      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep draft" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(isOpen("email-compose")).toBe(true);
      expect(getComposeState()?.draft.body).toBe("Half a thought");

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard draft" }));
      await waitFor(() => expect(isOpen("email-compose")).toBe(false));
      expect(getComposeState()).toBeNull();
    });

    it("cancels an empty draft without asking", async () => {
      const user = userEvent.setup();
      startCompose("gmail");
      renderPane("email-compose", { provider: "gmail" });

      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(isOpen("email-compose")).toBe(false));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("refuses to send without a valid recipient", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      startCompose("gmail", { mode: "compose", to: "not-an-address", cc: "", bcc: "", subject: "Hi", body: "Hello" });
      renderPane("email-compose", { provider: "gmail" });

      await user.click(await screen.findByRole("button", { name: /Send/ }));
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("Enter at least one valid recipient in To", { duration: 3500 }));
      expect(createDraft).not.toHaveBeenCalled();
    });
  });
});

describe("Email layout", () => {
  const resolve = (path: string) => registry.routes.resolve(path);

  it("keeps every old URL working", () => {
    expect(resolve("/email")).toMatchObject({ app: "email", viewId: "email-start", params: {} });
    expect(resolve("/email/gmail")).toMatchObject({ viewId: "email-start", params: { provider: "gmail" } });
    expect(resolve("/email/gmail/compose")).toMatchObject({ viewId: "email-compose", params: { provider: "gmail" } });
    expect(resolve("/email/gmail/inbox/m1")).toMatchObject({ viewId: "email-message", params: { provider: "gmail", box: "inbox", messageId: "m1" } });
  });

  it("builds URLs with encoded providers, boxes and message ids", () => {
    const url = registry.routes.urlFor("email", "email-message", { provider: "a@b.com", box: "All Mail", messageId: "m/1" });
    expect(url).toBe("/email/a%40b.com/All%20Mail/m%2F1");
    expect(resolve(url!)).toMatchObject({ params: { provider: "a@b.com", box: "All Mail", messageId: "m/1" } });
  });

  it("opens one tab per message, however it was listed", () => {
    const a = resolve("/email/gmail/inbox/m1");
    const b = resolve("/email/gmail/sent/m1");
    expect(a?.key).toBe(b?.key);
  });
});
