import type { PluginClientContext } from "@getpaseo/plugin/client";

// Values come from rose-pine/neovim lua/rose-pine/palette.lua (dawn).
// Paseo expands these eight keys into a larger token set, so the comments below
// record which derived token forced a value away from the obvious source color.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "rose-pine-dawn",
    name: "Rosé Pine Dawn",
    appearance: "light",
    colors: {
      background: "#FAF4ED",
      foreground: "#464261",
      // highlight_low, not surface: surface is lighter than base, and raised also
      // fills hovered rows, where a lighter tint barely shows on base
      raised: "#F4EDE8",
      // overlay: surfaceSidebar in light themes
      control: "#F2E9E1",
      border: "#DFDAD9",
      mutedForeground: "#797593",
      accent: "#907AA9",
      // muted: ring also fills foregroundExtraMuted and terminalBrightBlack
      ring: "#9893A5",
    },
  });
  return () => {};
}
