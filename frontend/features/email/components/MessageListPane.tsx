import type { EmailMessage, EmailProviderCapabilities } from "@tokenring-ai/email";
import NavigationSidebarHeader from "@tokenring-ai/one-frontend/components/layout/NavigationSidebarHeader.tsx";
import ErrorState from "@tokenring-ai/one-frontend/components/ui/ErrorState.tsx";
import FilterTabs from "@tokenring-ai/one-frontend/components/ui/FilterTabs.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import { toastManager } from "@tokenring-ai/one-frontend/components/ui/toast.tsx";
import { useBusyAction } from "@tokenring-ai/one-frontend/hooks/useBusyAction.ts";
import { usePaginatedList } from "@tokenring-ai/one-frontend/hooks/usePaginatedList.ts";
import { useRefSync } from "@tokenring-ai/one-frontend/hooks/useRefSync.ts";
import { emailRPCClient, useEmailMessages, useEmailSearch } from "@tokenring-ai/one-frontend/rpc.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@tokenring-ai/one-frontend/ui";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Archive, ChevronDown, FolderInput, Inbox, Loader2, MailOpen, MailWarning, RefreshCw, Star, StarOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type EmailMessageAction, modifyEmailMessages, moveTargets, useEmailCapabilities } from "../../../lib/emailQueries.ts";
import { BOX_META, DEFAULT_BOX_META, MESSAGE_FILTERS, PAGE_SIZE } from "../constants.ts";
import type { EmailBoxRecord, MessageFilter } from "../types.ts";
import MessageListItem from "./MessageListItem.tsx";

/** Rows on screen first, then ids kept selected after a partial failure took them off the page. */
function selectedIdsInOrder(messages: readonly EmailMessage[], selected: ReadonlySet<string>): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const msg of messages) {
    if (!selected.has(msg.id)) continue;
    seen.add(msg.id);
    ordered.push(msg.id);
  }
  for (const id of selected) {
    if (seen.has(id)) continue;
    ordered.push(id);
  }
  return ordered;
}

const bulkButtonClass =
  "inline-flex items-center gap-1 px-2 py-1 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

export default function MessageListPane({
  provider,
  box,
  boxes,
  selectedId,
  onSelect,
  messageFilter,
  onMessageFilterChange,
  searchQuery,
  refreshKey,
}: {
  provider: string | null;
  box: string;
  boxes: EmailBoxRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  messageFilter: MessageFilter;
  onMessageFilterChange: (filter: MessageFilter) => void;
  searchQuery: string | null;
  /** Bump to force list revalidation after send etc. */
  refreshKey?: number;
}) {
  const unreadOnly = messageFilter === "unread";
  // The list API can ask only for unread mail. Read mail is a real search (`is:read`),
  // not a client-side slice of whatever page was already loaded.
  const readConstraint = messageFilter === "read" ? "is:read" : null;
  const serverQuery = searchQuery && readConstraint ? `${searchQuery} ${readConstraint}` : (searchQuery ?? readConstraint);
  // Both hooks always run (Rules of Hooks); inactive one gets a null SWR key and does not fetch.
  const listing = useEmailMessages(serverQuery ? undefined : (provider ?? undefined), {
    box,
    limit: PAGE_SIZE,
    unreadOnly,
  });
  const search = useEmailSearch(provider ?? undefined, serverQuery ?? undefined, {
    box,
    limit: PAGE_SIZE,
    unreadOnly,
  });
  const result = serverQuery ? search : listing;
  // Keep latest result for refresh so mutate targets the active query after mode switches.
  const resultRef = useRefSync(result);
  const capabilities = useEmailCapabilities(provider);
  const { busy, execute } = useBusyAction();

  // Drop the selection when the list the user is looking at changes. A page load does not.
  const listScope = `${provider ?? ""}\0${box}\0${searchQuery ?? ""}\0${messageFilter}`;
  const listScopeRef = useRefSync(listScope);
  const [trackedScope, setTrackedScope] = useState(listScope);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  if (trackedScope !== listScope) {
    setTrackedScope(listScope);
    setSelectedIds(new Set());
  }

  const fetchNextPage = useCallback(
    async (pageToken: string) => {
      const page = serverQuery
        ? await emailRPCClient.searchMessages({ provider: provider!, query: serverQuery, box, limit: PAGE_SIZE, unreadOnly, pageToken })
        : await emailRPCClient.getMessages({ provider: provider!, box, limit: PAGE_SIZE, unreadOnly, pageToken });
      return { items: page.messages as EmailMessage[], nextPageToken: page.nextPageToken };
    },
    [box, provider, serverQuery, unreadOnly],
  );

  const {
    items: messages,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
  } = usePaginatedList<EmailMessage>({
    firstPage: result.data?.messages as EmailMessage[] | undefined,
    firstPageToken: result.data?.nextPageToken,
    resetKeys: [provider, box, searchQuery, messageFilter],
    refreshKey,
    mutate: () => resultRef.current.mutate(),
    fetchNextPage,
    paginationDisabled: !provider,
    onError: err => toastManager.error(formatError(err), { duration: 4000 }),
  });

  const filteredMessages = useMemo(
    () =>
      messages.filter(msg => {
        if (messageFilter === "read") return msg.isRead;
        // Unread is requested from the provider; this still drops a row the provider marked read.
        if (messageFilter === "unread") return !msg.isRead;
        return true;
      }),
    [messageFilter, messages],
  );

  const baseCount = result.data?.messages.length ?? 0;
  const hasLoadedMore = messages.length > baseCount;

  const countLabel = useMemo(() => {
    if (!result.data) return "";
    const n = filteredMessages.length;
    if (messageFilter === "all" && !hasLoadedMore) {
      // A count is one page; more pages behind it make it a lower bound.
      const count = `${result.data.count}${hasMore ? "+" : ""}`;
      return searchQuery ? `${count} results` : `${count} messages`;
    }
    const suffix = searchQuery ? "results" : "messages";
    const filterLabel = messageFilter === "all" ? "" : `${messageFilter} `;
    return `${n} ${filterLabel}${suffix}`.replace("  ", " ");
  }, [filteredMessages.length, hasLoadedMore, hasMore, messageFilter, result.data, searchQuery]);

  const visibleSelectedCount = filteredMessages.filter(msg => selectedIds.has(msg.id)).length;
  const allSelected = filteredMessages.length > 0 && visibleSelectedCount === filteredMessages.length;
  const someSelected = visibleSelectedCount > 0 && !allSelected;
  const targets = moveTargets(boxes, box);

  const toggleAll = () => {
    if (busy) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        for (const msg of filteredMessages) next.delete(msg.id);
      } else {
        for (const msg of filteredMessages) next.add(msg.id);
      }
      return next;
    });
  };

  const toggleMessage = (id: string, checked: boolean) => {
    if (busy) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const applyBulk = (action: EmailMessageAction) => {
    if (!provider || selectedIds.size === 0) return;
    const ids = selectedIdsInOrder(filteredMessages, selectedIds);
    const scopeAtStart = listScope;
    void execute(async () => {
      try {
        const result = await modifyEmailMessages(provider, ids, action);
        const stillHere = listScopeRef.current === scopeAtStart;
        if (result.failed.length > 0) {
          for (const failure of result.failed) toastManager.error(failure.error, { duration: 5000 });
          if (stillHere) setSelectedIds(new Set(result.failed.map(failure => failure.id)));
        } else {
          toastManager.success(result.message, { duration: 2500 });
          if (stillHere) setSelectedIds(new Set());
        }
        if (stillHere && result.succeeded.length > 0) refresh();
      } catch (err) {
        toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
      }
    });
  };

  const emptyMessage = searchQuery
    ? `No ${messageFilter === "all" ? "emails" : messageFilter} emails found for "${searchQuery}"`
    : messageFilter === "unread"
      ? `No unread messages in ${box}`
      : messageFilter === "read"
        ? `No read messages in ${box}`
        : `${box} is empty`;

  const showSelection = !result.isLoading && !result.error && filteredMessages.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <NavigationSidebarHeader
        title="Messages"
        meta={countLabel || undefined}
        actions={[
          {
            icon: <RefreshCw className={result.isValidating ? "w-3 h-3 animate-spin" : "w-3 h-3"} />,
            label: "Refresh messages",
            title: "Refresh",
            onClick: () => refresh(),
          },
        ]}
      />

      <FilterTabs
        tabs={MESSAGE_FILTERS}
        value={messageFilter}
        onChange={onMessageFilterChange}
        className="bg-secondary"
        activeTabClassName="border-red-500 text-primary"
      />

      {showSelection && (
        <MessageSelectionBar
          allSelected={allSelected}
          someSelected={someSelected}
          selectedCount={selectedIds.size}
          busy={busy}
          capabilities={capabilities}
          targets={targets}
          onToggleAll={toggleAll}
          onAction={applyBulk}
        />
      )}

      <div className="flex-1 overflow-y-auto relative">
        {result.isLoading ? (
          <LoadingState size="sm" className="py-10" />
        ) : result.error ? (
          <ErrorState title="Failed to load messages" error={result.error} onRetry={() => void result.mutate()} variant="inline" className="py-8" />
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted p-4 text-center">
            <Inbox className="w-8 h-8 opacity-30" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <>
            {filteredMessages.map(msg => (
              <MessageListItem
                key={msg.id}
                msg={msg}
                selected={msg.id === selectedId}
                checked={selectedIds.has(msg.id)}
                disabled={busy}
                onCheckedChange={checked => toggleMessage(msg.id, checked)}
                onClick={() => onSelect(msg.id)}
              />
            ))}
            {hasMore && (
              <div className="p-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="px-3 py-1.5 text-xs font-medium text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                    </span>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MessageSelectionBar({
  allSelected,
  someSelected,
  selectedCount,
  busy,
  capabilities,
  targets,
  onToggleAll,
  onAction,
}: {
  allSelected: boolean;
  someSelected: boolean;
  selectedCount: number;
  busy: boolean;
  capabilities: EmailProviderCapabilities | undefined;
  targets: EmailBoxRecord[];
  onToggleAll: () => void;
  onAction: (action: EmailMessageAction) => void;
}) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div className="shrink-0 flex items-start gap-2 border-b border-primary bg-secondary px-2.5 py-1.5">
      <label className="flex items-center gap-1.5 pt-0.5 shrink-0 cursor-pointer">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          disabled={busy}
          onChange={onToggleAll}
          aria-label="Select all on this page"
          className="accent-red-500 cursor-pointer disabled:cursor-not-allowed"
        />
        {selectedCount === 0 && <span className="text-xs text-muted">Select all on this page</span>}
      </label>
      {selectedCount > 0 && (
        <div role="toolbar" aria-label="Bulk actions" className="flex flex-wrap items-center gap-1 min-w-0">
          <span className="text-xs text-muted pr-1">{selectedCount} selected</span>
          <button type="button" onClick={() => onAction({ type: "markRead" })} disabled={busy} className={bulkButtonClass}>
            <MailOpen className="w-3.5 h-3.5" /> Mark read
          </button>
          {capabilities?.markUnread && (
            <button type="button" onClick={() => onAction({ type: "markUnread" })} disabled={busy} className={bulkButtonClass}>
              <MailWarning className="w-3.5 h-3.5" /> Mark unread
            </button>
          )}
          {capabilities?.star && (
            <>
              <button type="button" onClick={() => onAction({ type: "star", starred: true })} disabled={busy} className={bulkButtonClass}>
                <Star className="w-3.5 h-3.5" /> Star
              </button>
              <button type="button" onClick={() => onAction({ type: "star", starred: false })} disabled={busy} className={bulkButtonClass}>
                <StarOff className="w-3.5 h-3.5" /> Unstar
              </button>
            </>
          )}
          {capabilities?.archive && (
            <button
              type="button"
              onClick={() => onAction({ type: "archive" })}
              disabled={busy}
              className={bulkButtonClass}
              title="Remove from the inbox; it stays searchable"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
          )}
          {capabilities?.move && targets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={busy}>
                <button type="button" disabled={busy} className={bulkButtonClass}>
                  <FolderInput className="w-3.5 h-3.5" /> Move to <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {targets.map(target => {
                  const meta = BOX_META[target.id] ?? DEFAULT_BOX_META;
                  const Icon = meta.icon;
                  return (
                    <DropdownMenuItem key={target.id} onSelect={() => onAction({ type: "move", box: target.id })} className="gap-2 text-xs">
                      <Icon className={`w-3.5 h-3.5 ${meta.color}`} /> {target.name}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
