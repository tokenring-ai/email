import { useAttachedAgentChat } from "@tokenring-ai/one-frontend/apps/chat/useAttachedAgentChat.ts";
import AgentSessionList from "@tokenring-ai/one-frontend/components/AgentSessionList.tsx";
import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import ViewHeader from "@tokenring-ai/one-frontend/components/ui/ViewHeader.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { useConfirmDialog } from "@tokenring-ai/one-frontend/hooks/useConfirmDialog.tsx";
import { useLayoutApi } from "@tokenring-ai/one-frontend/layout/context.ts";
import { useEmailBoxes, useEmailConfiguration } from "@tokenring-ai/one-frontend/rpc.ts";
import { Button, TextField } from "@tokenring-ai/one-frontend/ui";
import { Mail, PenSquare, Search, Settings2, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MailboxDropdown from "../features/email/components/MailboxDropdown.tsx";
import MessageListPane from "../features/email/components/MessageListPane.tsx";
import ProviderSelector from "../features/email/components/ProviderSelector.tsx";
import WatchStatus from "../features/email/components/WatchStatus.tsx";
import { EMAIL_MESSAGE_VIEW_ID, EMAIL_START_VIEW_ID } from "../ids.ts";
import { EMAIL_PROVIDER_CONFIG_HREF, useEmailAgentSession, useSyncEmailState } from "../lib/emailCommon.tsx";
import { useEmailWatchStatus } from "../lib/emailQueries.ts";
import { rememberEmailProvider, resetEmailBrowser, setEmailBrowserState, useEmailBrowserStore, useRememberedEmailProvider } from "../lib/emailStore.ts";
import { useEmailLayoutNavigation } from "../lib/useEmailLayoutNavigation.ts";

/** Agent sessions the Email app can attach to; keeps the chat tab beside the messages. */
function EmailAgentSessions() {
  const { agentId, agents, isLoading, selectAgent, createAgent, terminateAgent, TerminateDialog } = useEmailAgentSession();
  useAttachedAgentChat({ agentId });
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
 * The Email navigator: provider and mailbox pickers, search, the message list
 * and the agent sessions. Rows open one tab per message.
 */
export default function EmailNavigatorPane() {
  const { route } = useLayoutApi();
  const routeProvider = route?.params.provider;
  const messageRoute = route?.viewId === EMAIL_MESSAGE_VIEW_ID ? route.params : null;
  const routeBox = messageRoute?.box;
  const routeMessageId = messageRoute?.messageId;
  const { openProvider, openMessage, openCompose } = useEmailLayoutNavigation();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const navigate = useNavigate();

  const configuration = useEmailConfiguration();
  const providers = useMemo(() => configuration.data?.providers ?? [], [configuration.data]);
  // The URL is the source of truth; while another tab (a chat) holds it, the last provider stays.
  const remembered = useRememberedEmailProvider();
  const provider = routeProvider ?? remembered;
  useEffect(() => {
    if (routeProvider) rememberEmailProvider(routeProvider);
  }, [routeProvider]);

  const { box: storedBox, searchQuery, messageFilter, listRefreshKey } = useEmailBrowserStore();
  const [searchInput, setSearchInput] = useState("");
  // Anything else that clears the search (a provider switch, another pane) clears the box as well.
  useEffect(() => {
    if (searchQuery === null) setSearchInput("");
  }, [searchQuery]);
  const { agentId } = useEmailAgentSession();
  useSyncEmailState(agentId, provider);

  const boxesQuery = useEmailBoxes(provider ?? undefined);
  const boxes = useMemo(() => boxesQuery.data?.boxes ?? [], [boxesQuery.data]);

  // /email (or an unknown provider) lands on the first configured provider.
  const atStart = route?.viewId === EMAIL_START_VIEW_ID;
  useEffect(() => {
    if (configuration.isLoading || !route) return;
    if (providers.length === 0) {
      if (routeProvider) openProvider(null, { replace: true });
      return;
    }
    if (atStart && (!routeProvider || !providers.includes(routeProvider))) openProvider(providers[0]!, { replace: true });
  }, [atStart, configuration.isLoading, openProvider, providers, route, routeProvider]);

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

  const selectedId = routeMessageId ?? null;

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
        title="No account connected"
        hint="Connect your Google account to read and send email here. A short step-by-step guide walks you through it, and you only do it once."
        variant="page"
        ctaLabel="Connect Google"
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
                <MailboxDropdown
                  boxes={boxes}
                  selected={box}
                  onSelect={id => {
                    // The search is cleared with the mailbox switch, so clear what the box shows too.
                    setSearchInput("");
                    setEmailBrowserState({ box: id, searchQuery: null });
                  }}
                />
              ) : (
                <span className="flex-1 text-xs font-bold text-muted uppercase tracking-widest px-1 truncate">Email</span>
              )}
              <div className="flex-1" />
              <Button
                icon={PenSquare}
                onClick={() => provider && void openCompose(provider, undefined, openConfirm)}
                disabled={!provider}
                title={provider ? "Write a new email" : "Configure an email provider (Gmail via the Google plugin) to compose"}
                className="shrink-0"
              >
                Compose
              </Button>
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
          <TextField
            aria-label="Search emails"
            placeholder="Search emails…"
            value={searchInput}
            onChange={setSearchInput}
            leading={<Search className="w-3.5 h-3.5" aria-hidden="true" />}
            className="flex-1 min-w-0"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setEmailBrowserState({ searchQuery: null });
              }}
              className="shrink-0"
            >
              Clear
            </Button>
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

      <div className="shrink-0 border-t border-primary">
        <EmailAgentSessions />
      </div>
      <ConfirmDialog />
    </ViewShell>
  );
}
