import { usePaneLink } from "@tokenring-ai/one-frontend/layout/hooks.ts";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { ComposeDraft } from "../features/email/types.ts";
import { EMAIL_COMPOSE_VIEW_ID, EMAIL_MESSAGE_VIEW_ID } from "../ids.ts";
import { type ConfirmReplaceDraft, replaceDraftConfirmOptions } from "./emailCommon.tsx";
import { getComposeState, hasUnsavedChanges, isDraftDirty, startCompose } from "./emailStore.ts";
import { providerPath } from "./paths.ts";

/**
 * Navigation between the Email views on the layout engine. Opening a message
 * or the compose tab navigates to its URL (the engine opens the tab); the
 * "Select a message" placeholder has done its job once a message is open.
 */
export function useEmailLayoutNavigation() {
  const open = usePaneLink();
  const navigate = useNavigate();

  return {
    /** Switches the browsed provider without opening a message tab. */
    openProvider: useCallback(
      (provider: string | null, options?: { replace?: boolean }) => void navigate(providerPath(provider), options?.replace ? { replace: true } : undefined),
      [navigate],
    ),
    openMessage: useCallback(
      (provider: string, box: string, messageId: string) => {
        open(EMAIL_MESSAGE_VIEW_ID, { provider, box, messageId });
      },
      [open],
    ),
    /**
     * Opens the single compose tab, optionally seeded with a reply / forward
     * draft. An unsent draft is never silently replaced: "Compose" for the same
     * provider (or reopening the same saved draft) resumes it; anything else asks
     * through `confirmReplace` unless the draft is saved, unchanged, at the
     * provider (and keeps the draft when there is no way to ask). Resolves
     * whether the tab opened.
     */
    openCompose: useCallback(
      async (provider: string, draft?: ComposeDraft, confirmReplace?: ConfirmReplaceDraft): Promise<boolean> => {
        const current = getComposeState();
        if (current && isDraftDirty(current.draft)) {
          const sameSavedDraft = draft?.serverDraftId !== undefined && draft.serverDraftId === current.draft.serverDraftId;
          if ((!draft || sameSavedDraft) && current.provider === provider) {
            open(EMAIL_COMPOSE_VIEW_ID, { provider });
            return true;
          }
          // A draft already saved, unchanged, to the provider is safe to replace.
          if (hasUnsavedChanges(current)) {
            const confirmed = confirmReplace ? await confirmReplace(replaceDraftConfirmOptions(current.provider, provider)) : false;
            if (!confirmed) return false;
          }
        }
        startCompose(provider, draft);
        open(EMAIL_COMPOSE_VIEW_ID, { provider });
        return true;
      },
      [open],
    ),
  };
}
