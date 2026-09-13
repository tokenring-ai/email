import manifest from "./manifest.ts";
import EmailApp from "./EmailApp.tsx";
import type { PluginAppDefinition } from "@tokenring-ai/one-frontend/plugins/types.ts";

/**
 * The email app contributed to the TokenRing One frontend by this
 * plugin. Discovered by `frontend/src/plugins/registry.ts`.
 */
export default {
  ...manifest,
  routePath: "/email/:provider?",
  component: EmailApp,
} satisfies PluginAppDefinition;
