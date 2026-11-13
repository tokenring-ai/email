import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import { Mail } from "lucide-react";

/** The "Select a message" placeholder at `/email` and `/email/<provider>`. */
export default function EmailStartPane() {
  return (
    <EmptyState
      icon={Mail}
      iconBadgeClassName="bg-linear-to-br from-red-500 to-rose-600"
      title="Select a message"
      hint="Pick a message from the list to read it here, or compose a new email."
      variant="page"
    />
  );
}
