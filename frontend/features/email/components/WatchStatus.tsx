import { Badge } from "@tokenring-ai/one-frontend/ui";
import { Eye } from "lucide-react";

export interface EmailWatchStatusData {
  configured: boolean;
  running: boolean;
  pollIntervalSeconds: number;
  unreadOnly: boolean;
  markAsRead: boolean;
  actionCount: number;
  processedCount: number;
}

/** One-line summary of the watch settings, used as the row's tooltip. */
export function describeWatch(status: EmailWatchStatusData): string {
  if (!status.configured) return "This agent has no inbox watch. Configure email.watch on the agent to run commands for matching mail.";
  const parts = [
    `Checks the inbox every ${status.pollIntervalSeconds}s`,
    status.unreadOnly ? "unread mail only" : "all mail",
    `${status.actionCount} ${status.actionCount === 1 ? "action" : "actions"}`,
    status.markAsRead ? "marks matches read" : null,
    `${status.processedCount} processed so far`,
  ];
  return parts.filter(Boolean).join(" · ");
}

/**
 * Read-only status of the attached agent's inbox watch (EmailService.watchEmails):
 * whether it is configured and whether the polling loop is running.
 */
export default function WatchStatus({ status }: { status: EmailWatchStatusData }) {
  const { tone, label } = !status.configured
    ? ({ tone: "neutral", label: "Not configured" } as const)
    : status.running
      ? ({ tone: "success", label: "Watching" } as const)
      : ({ tone: "warning", label: "Stopped" } as const);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted min-w-0" title={describeWatch(status)} data-testid="email-watch-status">
      <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="shrink-0">Inbox watch</span>
      <Badge tone={tone} dot pulse={status.configured && status.running}>
        {label}
      </Badge>
      {status.configured && (
        <span className="truncate">
          every {status.pollIntervalSeconds}s · {status.actionCount} {status.actionCount === 1 ? "action" : "actions"}
        </span>
      )}
    </div>
  );
}
