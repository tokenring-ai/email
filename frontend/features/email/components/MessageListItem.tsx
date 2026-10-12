import type { EmailMessage } from "@tokenring-ai/email";
import ContentListItem from "@tokenring-ai/one-frontend/components/ui/ContentListItem.tsx";
import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import { messageTimestamp, senderName } from "../utils.ts";

export default function MessageListItem({
  msg,
  selected,
  checked,
  disabled = false,
  onCheckedChange,
  onClick,
}: {
  msg: EmailMessage;
  /** The message currently open in the reading pane, not the bulk-selection check. */
  selected: boolean;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onClick: () => void;
}) {
  const subject = msg.subject || "(no subject)";
  return (
    <div className="flex items-stretch w-full min-w-0 border-b border-primary">
      {/* Sibling of the row button: a control inside ContentListItem would activate it. */}
      <label className="flex items-start pt-3.5 pl-2.5 pr-0.5 shrink-0 cursor-pointer" onClick={event => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={event => onCheckedChange(event.target.checked)}
          aria-label={`Select ${senderName(msg)}, ${subject}`}
          className="accent-red-500 cursor-pointer disabled:cursor-not-allowed"
        />
      </label>
      <ContentListItem
        className="flex-1 min-w-0 w-auto border-b-0"
        selected={selected}
        onClick={onClick}
        title={senderName(msg)}
        status={<span className="text-xs text-muted shrink-0">{formatDate(messageTimestamp(msg))}</span>}
        subtitle={subject}
        snippet={msg.snippet || undefined}
        indicator={!msg.isRead ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute right-3 top-3" aria-hidden="true" /> : undefined}
        selectedBorderColor="border-l-red-500"
        emphasized={!msg.isRead}
      />
    </div>
  );
}
