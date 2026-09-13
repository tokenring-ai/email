import { Mail } from "lucide-react";
import type { PluginAppManifest } from "@tokenring-ai/one-frontend/plugins/types.ts";

/**
 * Metadata for the email app shipped by this plugin. The frontend merges
 * this into its app registry and derives the SPA server routes from it.
 */
export default {
  id: "email",
  path: "/email",
  label: "Email",
  shortLabel: "EM",
  description: "Read, compose, and manage emails",
  group: "Data & tools",
  icon: Mail,
  iconClass: "text-red-500",
  gradient: "from-red-500 to-rose-600",
} satisfies PluginAppManifest;
