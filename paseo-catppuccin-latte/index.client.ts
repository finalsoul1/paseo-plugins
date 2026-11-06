import type { PluginClientContext } from "@getpaseo/plugin/client";

// Values come from catppuccin/palette palette.json (Latte).
// Paseo expands these eight keys into a larger token set, so the comments below
// record which derived token decided between neighboring palette colors.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    appearance: "light",
    colors: {
      background: "#EFF1F5",
      foreground: "#4C4F69",
      // mantle; raised also fills hovered sidebar rows, so it has to differ from control
      raised: "#E6E9EF",
      // crust: surfaceSidebar in light themes
      control: "#DCE0E8",
      // surface0, not surface1: this also fills surface3, where darker reads heavy
      border: "#CCD0DA",
      mutedForeground: "#6C6F85",
      accent: "#8839EF",
      // overlay0: ring also fills foregroundExtraMuted and terminalBrightBlack
      ring: "#9CA0B0",
    },
  });
  return () => {};
}
