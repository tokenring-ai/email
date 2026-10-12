import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EmailMessage } from "@tokenring-ai/email";
import { getPanelBadge } from "@tokenring-ai/one-frontend/dock/panelBadges.ts";
import type { DashboardDefinition, ViewDefinition, ViewParams } from "@tokenring-ai/one-frontend/dock/types.ts";
import { createFakeDashboardApi, createFakePanelHandle, type FakeDashboardApi, renderView } from "@tokenring-ai/one-frontend/test/dock.tsx";
import type React from "react";

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
const createAgent = mock(async (_args: { agentType: string; headless: boolean }) => ({ id: "agent-new", displayName: "Email Agent", description: "" }));
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
  useEmailSearch: (provider: string | undefined, query: string | undefined) => ({
    data:
      provider && query
        ? { messages: [searchHit], count: 1, message: "", ...(state.searchNextPageToken ? { nextPageToken: state.searchNextPageToken } : {}) }
        : undefined,
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: mock(async () => undefined),
  }),
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

const { default: contribution } = await import("../app.tsx");
const { resetEmailStore, getComposeState, setEmailBrowserState, startCompose, useEmailBrowserStore } = await import("../lib/emailStore.ts");

const ROUTES = ["/email/:provider?", "/email/:provider/compose", "/email/:provider/:box/:messageId", "/configuration/:plugin?"];
const viewById = (id: string) => contribution.views.find(view => view.id === id) as ViewDefinition<any>;
const getView = (id: string) => contribution.views.find(view => view.id === id);
const dashboard: DashboardDefinition = contribution.dashboards[0]!;

function fakeApi(): FakeDashboardApi {
  return createFakeDashboardApi({ dashboardId: "email", getView });
}

function renderEmailView(viewId: string, params: ViewParams = {}, path = "/email/gmail", api = fakeApi()) {
  const panel = createFakePanelHandle({ viewId, dashboardId: api.dashboardId, panelId: `${viewId}:${JSON.stringify(params)}`, params });
  return renderView(viewById(viewId), params, { api, panel, path, routes: ROUTES });
}

const pathname = () => screen.getByTestId("pathname").textContent;
const dirtyDraft = (body: string) => ({ mode: "compose" as const, to: "", cc: "", bcc: "", subject: "", body });

describe("Email dashboard views", () => {
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
    state.capabilities = { markUnread: true, archive: true, star: true, move: true, resumeDrafts: true };
    state.watch = undefined;
  });

  describe("navigator", () => {
    it("lists the inbox and opens a message in the main area", async () => {
      const user = userEvent.setup();
      const { api } = renderEmailView("email-messages");

      expect(await screen.findByText("Launch plan")).toBeInTheDocument();
      await user.click(screen.getByText("Launch plan"));

      expect(api.opened).toEqual([expect.objectContaining({ viewId: "email-message", params: { provider: "gmail", box: "inbox", messageId: "m1" } })]);
      expect(pathname()).toBe("/email/gmail/inbox/m1");
    });

    it("does not open a message when its checkbox is clicked", async () => {
      const user = userEvent.setup();
      const { api } = renderEmailView("email-messages");

      const checkbox = await screen.findByRole("checkbox", { name: /Launch plan/ });
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
      expect(api.opened).toEqual([]);
      expect(pathname()).toBe("/email/gmail");

      await user.click(screen.getByText("Launch plan"));
      expect(api.opened).toEqual([expect.objectContaining({ viewId: "email-message", params: { provider: "gmail", box: "inbox", messageId: "m1" } })]);
      expect(pathname()).toBe("/email/gmail/inbox/m1");
    });

    it("selects every message on the page and archives them in one call", async () => {
      const user = userEvent.setup();
      state.messages = [inboxMessage, secondMessage];
      renderEmailView("email-messages");

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
      renderEmailView("email-messages");

      await user.click(await screen.findByRole("checkbox", { name: "Select all on this page" }));
      await user.click(screen.getByRole("button", { name: "Archive" }));

      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("quota", { duration: 5000 }));
      expect(screen.getByRole("checkbox", { name: /Budget review/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /Launch plan/ })).not.toBeChecked();
      expect(modifyMessages).toHaveBeenCalledTimes(1);
    });

    it("clears the selection when the filter changes", async () => {
      const user = userEvent.setup();
      state.messages = [inboxMessage, secondMessage];
      renderEmailView("email-messages");

      await user.click(await screen.findByRole("checkbox", { name: "Select all on this page" }));
      expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Unread" }));

      expect(screen.getByRole("checkbox", { name: /Launch plan/ })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: /Budget review/ })).not.toBeChecked();
      expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    });

    it("fills the placeholder message panel instead of opening a second one", async () => {
      const user = userEvent.setup();
      const api = fakeApi();
      api.panels.push({ panelId: "email-message:new", viewId: "email-message", params: {}, title: "Message" });
      renderEmailView("email-messages", {}, "/email/gmail", api);

      await user.click(await screen.findByText("Launch plan"));
      expect(api.opened).toHaveLength(0);
      expect(api.panels[0]!.params).toEqual({ provider: "gmail", box: "inbox", messageId: "m1" });
    });

    it("redirects /email to the first configured provider", async () => {
      renderEmailView("email-messages", {}, "/email");
      await waitFor(() => expect(pathname()).toBe("/email/gmail"));
    });

    it("searches messages and clears the search again", async () => {
      const user = userEvent.setup();
      renderEmailView("email-messages");

      await user.type(await screen.findByLabelText("Search emails"), "budget{Enter}");
      expect(await screen.findByText("Budget review")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear" }));
      expect(await screen.findByText("Launch plan")).toBeInTheDocument();
    });

    it("starts a draft and opens the compose panel", async () => {
      const user = userEvent.setup();
      const { api } = renderEmailView("email-messages");

      await user.click(await screen.findByRole("button", { name: /Compose/ }));
      expect(api.opened).toEqual([expect.objectContaining({ viewId: "email-compose" })]);
      expect(pathname()).toBe("/email/gmail/compose");
      expect(getComposeState()).toMatchObject({ provider: "gmail", draft: { mode: "compose" } });
    });

    it("keeps a mailbox picked while a message from another box is open", async () => {
      const store = renderHook(() => useEmailBrowserStore());
      renderEmailView("email-messages", {}, "/email/gmail/inbox/m1");
      await waitFor(() => expect(store.result.current.box).toBe("inbox"));

      act(() => setEmailBrowserState({ box: "sent", searchQuery: null }));
      // Re-renders must not snap the selection back to the routed box.
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(store.result.current.box).toBe("sent");
    });

    it("resumes an unsent draft instead of replacing it", async () => {
      const user = userEvent.setup();
      startCompose("gmail", dirtyDraft("Half a thought"));
      renderEmailView("email-messages");

      await user.click(await screen.findByRole("button", { name: /Compose/ }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(pathname()).toBe("/email/gmail/compose");
      expect(getComposeState()?.draft.body).toBe("Half a thought");
    });

    it("tells the user when no provider is configured and how to add Gmail", async () => {
      const user = userEvent.setup();
      state.providers = [];
      renderEmailView("email-messages", {}, "/email");
      expect(await screen.findByText("No email providers configured")).toBeInTheDocument();
      expect(screen.getAllByText(/Gmail/).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /Compose/ })).toHaveAttribute("title", expect.stringContaining("Configure an email provider"));

      await user.click(screen.getByRole("button", { name: "Open Google configuration" }));
      expect(pathname()).toBe("/configuration/%40tokenring-ai%2Fgoogle");
    });

    it("pages search results with the search's page token", async () => {
      const user = userEvent.setup();
      state.searchNextPageToken = "search-2";
      searchMessages.mockImplementationOnce(async () => ({ messages: [{ ...searchHit, id: "m3", subject: "Budget follow-up" }], count: 1, message: "" }));
      renderEmailView("email-messages");

      await user.type(await screen.findByLabelText("Search emails"), "budget{Enter}");
      expect(await screen.findByText("1+ results")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Load more" }));

      expect(await screen.findByText("Budget follow-up")).toBeInTheDocument();
      expect(searchMessages.mock.calls[0]![0]).toMatchObject({ provider: "gmail", query: "budget", pageToken: "search-2" });
      expect(getMessages).not.toHaveBeenCalled();
    });

    it("lists the dashboard's agents only on the Email dashboard", async () => {
      state.agents = [emailAgent];
      const { unmount } = renderEmailView("email-messages");
      expect(await screen.findByText("Email agents")).toBeInTheDocument();
      unmount();

      const homeApi = createFakeDashboardApi({ dashboardId: "home", getView });
      renderEmailView("email-messages", {}, "/email/gmail", homeApi);
      await waitFor(() => expect(screen.queryByText("Email agents")).not.toBeInTheDocument());
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
      renderEmailView("email-messages", {}, "/email/gmail", createFakeDashboardApi({ dashboardId: "email", getView }));

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
      renderEmailView("email-messages");

      expect(within(await screen.findByTestId("email-watch-status")).getByText("Not configured")).toBeInTheDocument();
    });
  });

  describe("message", () => {
    it("renders the message and titles its tab", async () => {
      const { panel } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      expect(await screen.findByText("Launch plan")).toBeInTheDocument();
      expect(screen.getByText("Here is the plan")).toBeInTheDocument();
      await waitFor(() => expect(panel.title).toBe("Launch plan"));
    });

    it("is a placeholder until a message is chosen", async () => {
      renderEmailView("email-message", {}, "/email/gmail");
      expect(await screen.findByText("Select a message")).toBeInTheDocument();
    });

    it("prefills a reply and opens the compose panel", async () => {
      const user = userEvent.setup();
      const { api } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: /^Reply$/ }));
      expect(api.opened).toEqual([expect.objectContaining({ viewId: "email-compose" })]);
      expect(pathname()).toBe("/email/gmail/compose");
      expect(getComposeState()?.draft).toMatchObject({ mode: "reply", to: "Alice <alice@example.com>", subject: "Re: Launch plan" });
    });

    it("asks before a reply replaces an unsent draft", async () => {
      const user = userEvent.setup();
      startCompose("gmail", dirtyDraft("Half a thought"));
      const { api } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: /^Reply$/ }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep draft" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(getComposeState()?.draft).toMatchObject({ mode: "compose", body: "Half a thought" });
      expect(api.opened).toHaveLength(0);

      await user.click(screen.getByRole("button", { name: /^Reply$/ }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard draft" }));
      await waitFor(() => expect(getComposeState()?.draft).toMatchObject({ mode: "reply", subject: "Re: Launch plan" }));
      expect(pathname()).toBe("/email/gmail/compose");
    });

    it("hands the message to the attached agent", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: /Reply with AI/ }));
      await waitFor(() => expect(sendInput).toHaveBeenCalled());
      expect(sendInput.mock.calls[0]![0]).toMatchObject({ agentId: "agent-1", input: { from: "Email App" } });
    });

    it("deletes the message after confirmation, then closes the panel and refreshes the list", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      const store = renderHook(() => useEmailBrowserStore());
      const before = store.result.current.listRefreshKey;
      const { panel } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: /^Delete$/ }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteMessage).toHaveBeenCalledWith({ agentId: "agent-1", id: "m1" }));
      expect(toastMocks.success).toHaveBeenCalledWith("Deleted message: m1", { duration: 2500 });
      await waitFor(() => expect(panel.closed).toBe(true));
      // The navigator list revalidates so the deleted row disappears.
      await waitFor(() => expect(store.result.current.listRefreshKey).toBe(before + 1));
    });

    it("keeps the message when the confirmation is cancelled", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      const { panel } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: /^Delete$/ }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(deleteMessage).not.toHaveBeenCalled();
      expect(panel.closed).toBe(false);
    });

    it("toasts and keeps the panel open when the delete fails", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      deleteMessage.mockImplementationOnce(async () => {
        throw new Error("Gmail said no");
      });
      const { panel } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: /^Delete$/ }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(toastMocks.error).toHaveBeenCalled());
      expect(toastMocks.error.mock.calls[0]![0]).toContain("Gmail said no");
      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(panel.closed).toBe(false);
    });

    it("marks an unread message as read and refreshes the list", async () => {
      const user = userEvent.setup();
      const store = renderHook(() => useEmailBrowserStore());
      const before = store.result.current.listRefreshKey;
      renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: "Mark as read" }));
      await waitFor(() => expect(markMessageAsRead).toHaveBeenCalledWith({ provider: "gmail", id: "m1" }));
      expect(mutateMessage).toHaveBeenCalled();
      await waitFor(() => expect(store.result.current.listRefreshKey).toBe(before + 1));
    });

    it("offers no mark-as-read for a message already read", async () => {
      state.message = { ...inboxMessage, isRead: true };
      renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");
      expect(await screen.findByText("Launch plan")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
    });

    it("archives the message, then closes the panel and refreshes the list", async () => {
      const user = userEvent.setup();
      const store = renderHook(() => useEmailBrowserStore());
      const before = store.result.current.listRefreshKey;
      const { panel } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: "Archive" }));
      await waitFor(() => expect(modifyMessages).toHaveBeenCalledWith({ provider: "gmail", ids: ["m1"], action: { type: "archive" } }));
      await waitFor(() => expect(panel.closed).toBe(true));
      expect(store.result.current.listRefreshKey).toBe(before + 1);
    });

    it("stars and marks unread in place", async () => {
      const user = userEvent.setup();
      state.message = { ...inboxMessage, isRead: true, isStarred: false };
      const { panel } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: "Star" }));
      await waitFor(() => expect(modifyMessages).toHaveBeenCalledWith({ provider: "gmail", ids: ["m1"], action: { type: "star", starred: true } }));
      await user.click(screen.getByRole("button", { name: "Mark unread" }));
      await waitFor(() => expect(modifyMessages).toHaveBeenLastCalledWith({ provider: "gmail", ids: ["m1"], action: { type: "markUnread" } }));
      expect(mutateMessage).toHaveBeenCalled();
      expect(panel.closed).toBe(false);
    });

    it("moves the message to another mailbox", async () => {
      const user = userEvent.setup();
      state.boxes = [
        { id: "inbox", name: "Inbox" },
        { id: "sent", name: "Sent" },
        { id: "spam", name: "Spam" },
      ];
      const { panel } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: /Move to/ }));
      // Sent is a view, and the message is already in the inbox.
      expect(screen.queryByRole("menuitem", { name: /Sent/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /Inbox/ })).not.toBeInTheDocument();
      await user.click(await screen.findByRole("menuitem", { name: /Spam/ }));

      await waitFor(() => expect(modifyMessages).toHaveBeenCalledWith({ provider: "gmail", ids: ["m1"], action: { type: "move", box: "spam" } }));
      await waitFor(() => expect(panel.closed).toBe(true));
    });

    it("hides mailbox actions the provider does not support", async () => {
      state.capabilities = { markUnread: false, archive: false, star: false, move: false, resumeDrafts: false };
      state.message = { ...inboxMessage, isRead: true };
      renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      expect(await screen.findByText("Launch plan")).toBeInTheDocument();
      for (const name of ["Archive", "Star", "Mark unread", /Move to/]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
    });

    it("toasts a failed mailbox change and keeps the panel", async () => {
      const user = userEvent.setup();
      modifyMessages.mockImplementationOnce(async args => ({ succeeded: [], failed: [{ id: args.ids[0]!, error: "quota" }], message: "" }));
      const { panel } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: "Archive" }));
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("quota", { duration: 5000 }));
      expect(panel.closed).toBe(false);
    });

    it("resumes a message from the Drafts box as its saved draft", async () => {
      const user = userEvent.setup();
      renderEmailView("email-message", { provider: "gmail", box: "drafts", messageId: "m1" }, "/email/gmail/drafts/m1");

      await user.click(await screen.findByRole("button", { name: "Edit draft" }));
      await waitFor(() => expect(getDraftForMessage).toHaveBeenCalledWith({ provider: "gmail", messageId: "m1" }));
      await waitFor(() => expect(getComposeState()?.draft).toMatchObject({ serverDraftId: "d9", to: "bob@example.com", subject: "Hi", body: "Hello there" }));
      expect(pathname()).toBe("/email/gmail/compose");
    });

    it("offers Edit draft only in the Drafts box", async () => {
      renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");
      expect(await screen.findByText("Launch plan")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Edit draft" })).not.toBeInTheDocument();
    });

    it("closes its own panel", async () => {
      const user = userEvent.setup();
      const { panel } = renderEmailView("email-message", { provider: "gmail", box: "inbox", messageId: "m1" }, "/email/gmail/inbox/m1");

      await user.click(await screen.findByRole("button", { name: "Close email" }));
      expect(panel.closed).toBe(true);
    });
  });

  describe("compose", () => {
    it("starts an empty draft from a deep link and keeps it when the panel is closed", async () => {
      const user = userEvent.setup();
      const first = renderEmailView("email-compose", {}, "/email/gmail/compose");

      await user.type(await first.findByLabelText("Message body"), "Half a thought");
      await waitFor(() => expect(getPanelBadge(first.panel.panelId)?.title).toBe("Unsent draft"));
      first.unmount();

      renderEmailView("email-compose", {}, "/email/gmail/compose");
      expect(await screen.findByLabelText("Message body")).toHaveValue("Half a thought");
    });

    it("composes through the provider in the URL, replacing an untouched draft for another one", async () => {
      startCompose("outlook");
      renderEmailView("email-compose", {}, "/email/gmail/compose");
      await waitFor(() => expect(getComposeState()?.provider).toBe("gmail"));
    });

    it("asks before a deep link replaces an unsent draft for another provider", async () => {
      const user = userEvent.setup();
      startCompose("outlook", dirtyDraft("Keep me"));
      renderEmailView("email-compose", {}, "/email/gmail/compose");

      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep draft" }));
      // Keeping it points the URL back at the draft's provider.
      await waitFor(() => expect(pathname()).toBe("/email/outlook/compose"));
      expect(getComposeState()).toMatchObject({ provider: "outlook", draft: { body: "Keep me" } });
    });

    it("starts a draft for the URL's provider once the user discards the other one", async () => {
      const user = userEvent.setup();
      startCompose("outlook", dirtyDraft("Throw away"));
      renderEmailView("email-compose", {}, "/email/gmail/compose");

      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard draft" }));
      await waitFor(() => expect(getComposeState()).toMatchObject({ provider: "gmail", draft: { body: "" } }));
      expect(pathname()).toBe("/email/gmail/compose");
    });

    it("sends the draft and closes the panel", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      startCompose("gmail", { mode: "compose", to: "bob@example.com", cc: "", bcc: "", subject: "Hi", body: "Hello there" });
      const { panel } = renderEmailView("email-compose", {}, "/email/gmail/compose");

      await user.click(await screen.findByRole("button", { name: /Send/ }));

      await waitFor(() => expect(createDraft).toHaveBeenCalled());
      expect(createDraft.mock.calls[0]![0]).toMatchObject({ agentId: "agent-1", subject: "Hi", to: [{ email: "bob@example.com" }] });
      await waitFor(() => expect(sendCurrentDraft).toHaveBeenCalledWith({ agentId: "agent-1" }));
      await waitFor(() => expect(panel.closed).toBe(true));
      expect(getComposeState()).toBeNull();
    });

    it("saves the draft to the provider, then updates it in place and closes without asking", async () => {
      const user = userEvent.setup();
      startCompose("gmail", { mode: "compose", to: "bob@example.com", cc: "", bcc: "", subject: "Hi", body: "Hello there" });
      const { panel } = renderEmailView("email-compose", {}, "/email/gmail/compose");

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
      await waitFor(() => expect(panel.closed).toBe(true));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("sends a saved draft in place instead of creating another", async () => {
      const user = userEvent.setup();
      startCompose("gmail", { mode: "compose", to: "bob@example.com", cc: "", bcc: "", subject: "Hi", body: "Hello there", serverDraftId: "d9" });
      const { panel } = renderEmailView("email-compose", {}, "/email/gmail/compose");

      await user.click(await screen.findByRole("button", { name: /Send/ }));
      await waitFor(() => expect(sendDraft).toHaveBeenCalledWith({ provider: "gmail", id: "d9" }));
      expect(saveDraft.mock.calls[0]![0]).toMatchObject({ id: "d9" });
      expect(createDraft).not.toHaveBeenCalled();
      await waitFor(() => expect(panel.closed).toBe(true));
    });

    it("asks before Cancel discards an unsent draft", async () => {
      const user = userEvent.setup();
      startCompose("gmail", dirtyDraft("Half a thought"));
      const { panel } = renderEmailView("email-compose", {}, "/email/gmail/compose");

      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep draft" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(panel.closed).toBe(false);
      expect(getComposeState()?.draft.body).toBe("Half a thought");

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard draft" }));
      await waitFor(() => expect(panel.closed).toBe(true));
      expect(getComposeState()).toBeNull();
    });

    it("cancels an empty draft without asking", async () => {
      const user = userEvent.setup();
      startCompose("gmail");
      const { panel } = renderEmailView("email-compose", {}, "/email/gmail/compose");

      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(panel.closed).toBe(true));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("refuses to send without a valid recipient", async () => {
      const user = userEvent.setup();
      state.agents = [emailAgent];
      startCompose("gmail", { mode: "compose", to: "not-an-address", cc: "", bcc: "", subject: "Hi", body: "Hello" });
      renderEmailView("email-compose", {}, "/email/gmail/compose");

      await user.click(await screen.findByRole("button", { name: /Send/ }));
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("Enter at least one valid recipient in To", { duration: 3500 }));
      expect(createDraft).not.toHaveBeenCalled();
    });
  });

  describe("dashboard definition", () => {
    it("opens the panel named by the route in the main area", () => {
      const api = fakeApi();
      api.panels.push({ panelId: "email-messages", viewId: "email-messages", params: {}, title: "Messages" });
      const match = (path: string, params: Record<string, string | undefined>) => ({ pathname: path, params, searchParams: new URLSearchParams() });

      dashboard.onNavigate?.(match("/email", {}), api);
      dashboard.onNavigate?.(match("/email/gmail", { provider: "gmail" }), api);
      dashboard.onNavigate?.(match("/email/gmail/inbox/m1", { provider: "gmail", box: "inbox", messageId: "m1" }), api);
      dashboard.onNavigate?.(match("/email/gmail/compose", { provider: "gmail" }), api);

      expect(api.opened.map(open => [open.viewId, open.params])).toEqual([
        ["email-message", { provider: "gmail", box: "inbox", messageId: "m1" }],
        ["email-compose", {}],
      ]);
      expect(api.opened[0]!.options).toMatchObject({ position: "right", referencePanelId: "email-messages" });
    });

    it("is idempotent: a repeated route focuses the open panel", () => {
      const api = fakeApi();
      const match = { pathname: "/email/gmail/inbox/m1", params: { provider: "gmail", box: "inbox", messageId: "m1" }, searchParams: new URLSearchParams() };
      dashboard.onNavigate?.(match, api);
      dashboard.onNavigate?.(match, api);
      expect(api.panels.filter(open => open.viewId === "email-message")).toHaveLength(1);
    });

    it("maps the active panel back to a URL", () => {
      const match = { pathname: "/email/gmail", params: { provider: "gmail" }, searchParams: new URLSearchParams() };
      const path = (viewId: string, params: ViewParams = {}) => dashboard.pathForActivePanel?.({ panelId: viewId, viewId, params }, match);

      expect(path("email-message", { provider: "gmail", box: "inbox", messageId: "m1" })).toBe("/email/gmail/inbox/m1");
      // The placeholder keeps the provider the navigator is browsing.
      expect(path("email-message")).toBe("/email/gmail");
      startCompose("gmail");
      expect(path("email-compose")).toBe("/email/gmail/compose");
      expect(path("email-messages")).toBeNull();
    });

    it("encodes providers, boxes and message ids in deep links", () => {
      const match = { pathname: "/email", params: {}, searchParams: new URLSearchParams() };
      const path = dashboard.pathForActivePanel?.(
        { panelId: "p", viewId: "email-message", params: { provider: "a@b.com", box: "All Mail", messageId: "m/1" } },
        match,
      );
      expect(path).toBe("/email/a%40b.com/All%20Mail/m%2F1");
    });
  });
});
