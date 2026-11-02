import type { PluginClientContext } from "@getpaseo/plugin/client";

// Values come from VS Code's theme-quietlight/themes/quietlight-color-theme.json.
// Paseo expands these eight keys into a larger token set, so the comments below
// record which derived token forced a value away from the obvious source color.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "quiet-light",
    name: "Quiet Light",
    appearance: "light",
    colors: {
      background: "#F5F5F5",
      foreground: "#333333",
      // welcomePage.tileBackground; Quiet Light has no white, chrome sits darker than the editor
      raised: "#F0F0F7",
      // surfaceSidebar in light themes, so this carries activityBar.background
      control: "#EDEDF5",
      // agentsChatInput.border is #C9D0D9, lightened because this also fills
      // surface3, where the source color reads as a heavy block
      border: "#DDE2E8",
      mutedForeground: "#6C6C6C",
      accent: "#705697",
      // editorWhitespace.foreground, not focusBorder: ring also fills foregroundExtraMuted
      // and terminalBrightBlack, where Quiet Light's purple would be wrong
      ring: "#AAAAAA",
    },
  });
  return () => {};
}
