import type { PluginClientContext } from "@getpaseo/plugin/client";

// Values come from Zed's assets/themes/one/one.json (One Light).
// Paseo expands these eight keys into a larger token set, so the comments below
// record which derived token forced a value away from the obvious source color.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "one-light",
    name: "One Light",
    appearance: "light",
    colors: {
      background: "#FAFAFA",
      foreground: "#242529",
      // Zed uses #EBEBEC for both panels and popovers, but raised also fills
      // hovered sidebar rows, so it has to differ from control to stay visible
      raised: "#F2F2F3",
      // surfaceSidebar in light themes, so this carries panel.background
      control: "#EBEBEC",
      // border.variant, not border: this also fills surface3, where #C9C9CA reads heavy
      border: "#DFDFE0",
      mutedForeground: "#58585A",
      accent: "#5C78E2",
      // editor.invisible: ring also fills foregroundExtraMuted and terminalBrightBlack
      ring: "#B4B4BB",
    },
  });
  return () => {};
}
