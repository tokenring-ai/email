import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import { setPanelBadge } from "@tokenring-ai/one-frontend/dock/panelBadges.ts";
import type { ViewProps } from "@tokenring-ai/one-frontend/dock/types.ts";
import { useConfirmDialog } from "@tokenring-ai/one-frontend/hooks/useConfirmDialog.tsx";
import { PenSquare } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ComposeForm from "../features/email/components/ComposeForm.tsx";
import type { ComposeMode } from "../features/email/types.ts";
import { discardDraftConfirmOptions, replaceDraftConfirmOptions, useEmailAgentSession } from "../lib/emailShared.tsx";
import {
  bumpEmailListRefresh,
  clearCompose,
  getComposeState,
  hasUnsavedChanges,
  markComposeSaved,
  startCompose,
  updateComposeDraft,
  useComposeState,
} from "../lib/emailStore.ts";
import { composePath, isComposePath } from "../lib/paths.ts";

const TAB_TITLES: Record<ComposeMode, string> = {
  compose: "New message",
  reply: "Reply",
  replyAll: "Reply all",
  forward: "Forward",
};

/**
 * The dashboard's single compose panel. The draft lives in a module store, so
 * closing the tab (or replying from another panel) never loses what is typed.
 */
export default function EmailComposeView({ panel }: ViewProps) {
  const compose = useComposeState();
  const { provider: routeProvider } = useParams<{ provider?: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { ensureAgent } = useEmailAgentSession();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();

  // A deep link to /email/<provider>/compose composes through that provider.
  // Handled once per compose route: a draft cleared by sending or cancelling
  // must not come back while the panel closes. A draft for another provider is
  // replaced — after asking, when it has unsent content; keeping it points the
  // URL back at the draft's provider instead.
  const composeRouteProvider = routeProvider && isComposePath(pathname) ? routeProvider : null;
  const handledRoute = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!composeRouteProvider) {
      handledRoute.current = null;
      return;
    }
    if (handledRoute.current === composeRouteProvider) return;
    handledRoute.current = composeRouteProvider;
    const current = getComposeState();
    if (current?.provider === composeRouteProvider) return;
    if (!current || !hasUnsavedChanges(current)) {
      startCompose(composeRouteProvider);
      return;
    }
    void openConfirm(replaceDraftConfirmOptions(current.provider, composeRouteProvider)).then(confirmed => {
      if (!mounted.current) return;
      // The draft may have been sent or replaced while the prompt was open.
      const latest = getComposeState();
      if (confirmed) {
        startCompose(composeRouteProvider);
      } else if (latest && latest.provider !== composeRouteProvider) {
        handledRoute.current = latest.provider;
        void navigate(composePath(latest.provider), { replace: true });
      }
    });
  }, [composeRouteProvider, navigate, openConfirm]);

  const mode = compose?.draft.mode;
  useEffect(() => {
    panel.setTitle(mode ? TAB_TITLES[mode] : "New message");
  }, [mode, panel]);

  // An unfinished draft marks the tab so a closed panel is still visibly pending.
  // A draft saved, unchanged, to the provider's Drafts box is not at risk.
  const dirty = compose ? hasUnsavedChanges(compose) : false;
  const panelId = panel.panelId;
  useEffect(() => {
    setPanelBadge(panelId, dirty ? { tone: "warning", title: "Unsent draft" } : null);
    return () => setPanelBadge(panelId, null);
  }, [dirty, panelId]);

  if (!compose) {
    return (
      <>
        <EmptyState icon={PenSquare} title="No draft" hint="Use Compose in the message list to start a new email." variant="page" />
        <ConfirmDialog />
      </>
    );
  }

  return (
    <>
      <ComposeForm
        provider={compose.provider}
        draft={compose.draft}
        session={compose.session}
        ensureAgent={ensureAgent}
        onChange={patch => updateComposeDraft(patch)}
        onClose={() => {
          // Cancel and the close button discard the draft, so an unsent one is confirmed first.
          const current = getComposeState();
          const discard = current && hasUnsavedChanges(current) ? openConfirm(discardDraftConfirmOptions(current.saved !== null)) : Promise.resolve(true);
          void discard.then(confirmed => {
            if (!confirmed || !mounted.current) return;
            clearCompose();
            panel.close();
          });
        }}
        unsavedEdits={dirty}
        onSaved={serverDraftId => {
          markComposeSaved(serverDraftId);
          bumpEmailListRefresh();
        }}
        onSent={() => {
          clearCompose();
          bumpEmailListRefresh();
          panel.close();
        }}
      />
      <ConfirmDialog />
    </>
  );
}
