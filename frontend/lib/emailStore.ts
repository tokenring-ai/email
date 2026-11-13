import { useSyncExternalStore } from "react";
import type { ComposeDraft, MessageFilter } from "../features/email/types.ts";
import { emptyComposeDraft } from "../features/email/utils.ts";

/**
 * State shared by the Email views. Each view is its own React subtree, so the
 * mailbox the navigator shows, its search and the compose draft live here
 * rather than in component state. In memory only.
 */

export interface EmailBrowserState {
  /** Mailbox the navigator lists; null means the provider's inbox. */
  box: string | null;
  /** Active search, or null when listing the mailbox. */
  searchQuery: string | null;
  messageFilter: MessageFilter;
  /** Bumped after a send so the list revalidates. */
  listRefreshKey: number;
}

const INITIAL: EmailBrowserState = { box: null, searchQuery: null, messageFilter: "all", listRefreshKey: 0 };

let state: EmailBrowserState = INITIAL;
const listeners = new Set<() => void>();

function update(next: EmailBrowserState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEmailBrowserStore(): EmailBrowserState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function setEmailBrowserState(patch: Partial<EmailBrowserState> | ((current: EmailBrowserState) => Partial<EmailBrowserState>)): void {
  const next = typeof patch === "function" ? patch(state) : patch;
  update({ ...state, ...next });
}

/** Clears mailbox and search (used when switching provider). */
export function resetEmailBrowser(): void {
  update({ ...state, box: null, searchQuery: null });
}

export function bumpEmailListRefresh(): void {
  update({ ...state, listRefreshKey: state.listRefreshKey + 1 });
}

// ─── Compose draft ─────────────────────────────────────────────────────────────

export interface ComposeState {
  /** Provider the message is sent through; fixed when the draft starts. */
  provider: string;
  draft: ComposeDraft;
  /** Increments whenever a fresh draft replaces the current one, so the form can reset focus. */
  session: number;
  /** The content last saved to the provider's Drafts box, or null when it has never been saved. */
  saved: ComposeDraft | null;
}

let compose: ComposeState | null = null;
const composeListeners = new Set<() => void>();

function updateCompose(next: ComposeState | null) {
  compose = next;
  for (const listener of composeListeners) listener();
}

export function getComposeState(): ComposeState | null {
  return compose;
}

export function useComposeState(): ComposeState | null {
  return useSyncExternalStore(
    listener => {
      composeListeners.add(listener);
      return () => {
        composeListeners.delete(listener);
      };
    },
    () => compose,
    () => compose,
  );
}

export function isDraftDirty(draft: ComposeDraft): boolean {
  return Boolean(draft.to || draft.cc || draft.bcc || draft.subject || draft.body);
}

/**
 * True when closing the draft would lose work: it has content that is not
 * already saved, unchanged, in the provider's Drafts box.
 */
export function hasUnsavedChanges(state: ComposeState): boolean {
  if (!isDraftDirty(state.draft)) return false;
  if (!state.saved) return true;
  const { draft, saved } = state;
  return draft.to !== saved.to || draft.cc !== saved.cc || draft.bcc !== saved.bcc || draft.subject !== saved.subject || draft.body !== saved.body;
}

/** Replaces the current draft (reply / forward / explicit new message, or a saved draft being resumed). */
export function startCompose(provider: string, draft: ComposeDraft = emptyComposeDraft()): void {
  updateCompose({ provider, draft, session: (compose?.session ?? 0) + 1, saved: draft.serverDraftId ? draft : null });
}

/** Records that the current content was saved as the provider draft `serverDraftId`. */
export function markComposeSaved(serverDraftId: string): void {
  if (!compose) return;
  const draft = { ...compose.draft, serverDraftId };
  updateCompose({ ...compose, draft, saved: draft });
}

/**
 * Makes sure a draft exists for `provider` without discarding one the user is
 * still writing: an untouched draft or one for another provider is replaced.
 */
export function ensureCompose(provider: string): void {
  if (compose && compose.provider === provider && isDraftDirty(compose.draft)) return;
  startCompose(provider);
}

export function updateComposeDraft(patch: Partial<ComposeDraft>): void {
  if (!compose) return;
  updateCompose({ ...compose, draft: { ...compose.draft, ...patch } });
}

export function clearCompose(): void {
  if (compose) updateCompose(null);
}

/** Test helper. */
export function resetEmailStore(): void {
  update(INITIAL);
  updateCompose(null);
  rememberEmailProvider(null);
}

// ─── Browsed provider ──────────────────────────────────────────────────────────

let browsedProvider: string | null = null;
const providerListeners = new Set<() => void>();

/** The provider the Email app last showed, so the navigator keeps it while another tab (a chat) holds the URL. */
export function rememberEmailProvider(provider: string | null): void {
  if (provider === browsedProvider) return;
  browsedProvider = provider;
  for (const listener of providerListeners) listener();
}

export function useRememberedEmailProvider(): string | null {
  return useSyncExternalStore(
    listener => {
      providerListeners.add(listener);
      return () => {
        providerListeners.delete(listener);
      };
    },
    () => browsedProvider,
    () => browsedProvider,
  );
}
