import AgentSessionList from "@tokenring-ai/one-frontend/components/AgentSessionList.tsx";
import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import ViewHeader from "@tokenring-ai/one-frontend/components/ui/ViewHeader.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { usePanel } from "@tokenring-ai/one-frontend/dock/PanelContext.tsx";
import { useAgentChatPanel } from "@tokenring-ai/one-frontend/dock/useAgentChatPanel.ts";
import { useConfirmDialog } from "@tokenring-ai/one-frontend/hooks/useConfirmDialog.tsx";
import { useEmailBoxes, useEmailConfiguration } from "@tokenring-ai/one-frontend/rpc.ts";
import { Mail, PenSquare, Search, Settings2, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MailboxDropdown from "../features/email/components/MailboxDropdown.tsx";
import MessageListPane from "../features/email/components/MessageListPane.tsx";
import ProviderSelector from "../features/email/components/ProviderSelector.tsx";
import WatchStatus from "../features/email/components/WatchStatus.tsx";
import { useEmailWatchStatus } from "../lib/emailQueries.ts";
import { EMAIL_PROVIDER_CONFIG_HREF, useEmailAgentSession, useEmailNavigation, useSyncEmailState } from "../lib/emailShared.tsx";
import { resetEmailBrowser, setEmailBrowserState, useEmailBrowserStore } from "../lib/emailStore.ts";
import { EMAIL_DASHBOARD_ID } from "../manifest.ts";

/** Agent sessions the Email dashboard can attach to; keeps the chat panel docked beside the messages. */
function EmailAgentSessions() {
  const { agentId, agents, isLoading, selectAgent, createAgent, terminateAgent, TerminateDialog } = useEmailAgentSession();
  useAgentChatPanel({ agentId });
  const watch = useEmailWatchStatus(agentId);

  return (
    <>
      {watch.data?.status === "success" && <WatchStatus status={watch.data} />}
      <AgentSessionList
        agents={agents}
        selectedAgentId={agentId}
        isLoading={isLoading}
        storageKey="email"
        label="Email agents"
        onSelect={selectAgent}
        onCreate={() => void createAgent()}
        onTerminate={id => void terminateAgent(id)}
      />
      <TerminateDialog />
    </>
  );
}

/**
 * The Email dashboard's navigator: provider and mailbox pickers, search, the
 * message list and the agent sessions. Rows open one panel per message; on
 * another dashboard they navigate to the Email dashboard instead.
 */
export default function EmailMessagesView() {
  const panel = usePanel();
  const inEmailDashboard = panel.dashboardId === EMAIL_DASHBOARD_ID;
  const { provider: routeProvider, box: routeBox, messageId: routeMessageId } = useParams<{ provider?: string; box?: string; messageId?: string }>();
  const { openProvider, openMessage, openCompose } = useEmailNavigation();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const navigate = useNavigate();

  const configuration = useEmailConfiguration();
  const providers = useMemo(() => configuration.data?.providers ?? [], [configuration.data]);
  // The URL is the source of truth on the Email dashboard; elsewhere the first provider is browsed.
  const provider = inEmailDashboard ? (routeProvider ?? null) : (providers[0] ?? null);

  const { box: storedBox, searchQuery, messageFilter, listRefreshKey } = useEmailBrowserStore();
  const [searchInput, setSearchInput] = useState("");
  const { agentId } = useEmailAgentSession();
  useSyncEmailState(agentId, provider);

  const boxesQuery = useEmailBoxes(provider ?? undefined);
  const boxes = useMemo(() => boxesQuery.data?.boxes ?? [], [boxesQuery.data]);

  // /email (or an unknown provider) lands on the first configured provider.
  useEffect(() => {
    if (!inEmailDashboard || configuration.isLoading) return;
    if (providers.length === 0) {
      if (routeProvider) openProvider(null, { replace: true });
      return;
    }
    if (!routeProvider || !providers.includes(routeProvider)) openProvider(providers[0]!, { replace: true });
  }, [configuration.isLoading, inEmailDashboard, openProvider, providers, routeProvider]);

  // A deep link into a mailbox selects it in the navigator — when the route
  // changes only. Comparing against the stored box on every render would undo
  // picking another mailbox while a message from the routed one is open.
  const previousRouteBox = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (routeBox === previousRouteBox.current) return;
    previousRouteBox.current = routeBox;
    if (routeBox && routeBox !== storedBox) setEmailBrowserState({ box: routeBox, searchQuery: null });
  }, [routeBox, storedBox]);

  const box = useMemo(() => {
    if (storedBox && boxes.some(candidate => candidate.id === storedBox)) return storedBox;
    if (storedBox && boxes.length === 0) return storedBox;
    return boxes.find(candidate => candidate.id === "inbox")?.id ?? boxes[0]?.id ?? "inbox";
  }, [boxes, storedBox]);

  const selectedId = inEmailDashboard ? (routeMessageId ?? null) : null;

  let body: React.ReactNode;
  if (!configuration.isLoading && providers.length === 0) {
    body = configuration.error ? (
      <EmptyState
        icon={WifiOff}
        title="Failed to load email providers"
        hint="Could not reach the email service."
        variant="page"
        ctaLabel="Retry"
        onCta={() => void configuration.mutate()}
      />
    ) : (
      <EmptyState
        icon={WifiOff}
        title="No email providers configured"
        hint="Email reads and sends through a provider. Gmail is available today: add a Google account with Gmail enabled in the Google (plugin/google) configuration, then come back here."
        variant="page"
        ctaLabel="Open Google configuration"
        ctaIcon={Settings2}
        onCta={() => void navigate(EMAIL_PROVIDER_CONFIG_HREF)}
      />
    );
  } else if (!provider) {
    body = <LoadingState message="Loading email providers…" size="sm" className="h-full" />;
  } else if (boxesQuery.isLoading && boxes.length === 0) {
    body = <LoadingState message="Loading mailboxes…" size="sm" className="h-full" />;
  } else if (!boxesQuery.isLoading && boxesQuery.error) {
    body = (
      <EmptyState
        icon={Mail}
        title="Failed to load mailboxes"
        hint="Could not list boxes for this provider."
        variant="page"
        ctaLabel="Retry"
        onCta={() => void boxesQuery.mutate()}
      />
    );
  } else if (!boxesQuery.isLoading && boxes.length === 0) {
    body = <EmptyState icon={Mail} title="No email boxes available" hint="The selected provider did not expose any readable email boxes." variant="page" />;
  } else {
    body = (
      <MessageListPane
        provider={provider}
        box={box}
        boxes={boxes}
        selectedId={selectedId}
        onSelect={id => openMessage(provider, box, id)}
        messageFilter={messageFilter}
        onMessageFilterChange={filter => setEmailBrowserState({ messageFilter: filter })}
        searchQuery={searchQuery}
        refreshKey={listRefreshKey}
      />
    );
  }

  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader
          variant="navigator"
          title={
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              {boxes.length > 0 ? (
                <MailboxDropdown boxes={boxes} selected={box} onSelect={id => setEmailBrowserState({ box: id, searchQuery: null })} />
              ) : (
                <span className="flex-1 text-xs font-bold text-muted uppercase tracking-widest px-1 truncate">Email</span>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => provider && void openCompose(provider, undefined, openConfirm)}
                disabled={!provider}
                title={provider ? "Write a new email" : "Configure an email provider (Gmail via the Google plugin) to compose"}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg shadow-button-primary focus-ring cursor-pointer transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PenSquare className="w-3.5 h-3.5" />
                Compose
              </button>
            </div>
          }
        />
      }
    >
      <div className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-primary">
        <form
          onSubmit={event => {
            event.preventDefault();
            setEmailBrowserState({ searchQuery: searchInput.trim() || null });
          }}
          className="flex-1 flex items-center gap-1.5 min-w-0"
        >
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search emails"
              placeholder="Search emails…"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              className="w-full bg-input border border-primary rounded-lg py-1.5 pl-8 pr-3 text-xs text-primary placeholder-muted focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
            />
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setEmailBrowserState({ searchQuery: null });
              }}
              className="px-2 text-xs text-muted hover:text-primary transition-colors cursor-pointer shrink-0"
            >
              Clear
            </button>
          )}
        </form>
        <ProviderSelector
          provider={provider}
          availableProviders={providers}
          loading={configuration.isLoading}
          onProviderChange={next => {
            resetEmailBrowser();
            setSearchInput("");
            openProvider(next);
          }}
        />
      </div>

      <div className="flex-1 min-h-0">{body}</div>

      {inEmailDashboard && (
        <div className="shrink-0 border-t border-primary">
          <EmailAgentSessions />
        </div>
      )}
      <ConfirmDialog />
    </ViewShell>
  );
}
