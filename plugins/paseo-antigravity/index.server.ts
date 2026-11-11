import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createAntigravityProvider } from "./server/provider.js";
import { createAntigravityUsageSource } from "./server/usage.js";

export default function contribute(server: PluginServerContext) {
  server.registerProvider(createAntigravityProvider());
  server.registerUsageSource(createAntigravityUsageSource());
  return () => {};
}
