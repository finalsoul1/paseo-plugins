import type { PluginClientContext } from "@getpaseo/plugin/client";

// Solarized Light with the cream backgrounds faded toward white, and text, borders,
// and rings each moved one Solarized step darker so they stand out more against
// the paler surfaces. Accent keeps the solarized-light plugin's value.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "solar-paper",
    name: "Solar Paper",
    appearance: "light",
    colors: {
      // base3, 50% toward white
      background: "#FEFAF1",
      foreground: "#073642",
      // midpoint of background and control; raised also fills hovered sidebar rows,
      // so it has to differ from control
      raised: "#FAF6EC",
      // base2, 40% toward white: less than background so the sidebar still separates
      control: "#F5F1E6",
      // base2 mixed 40% toward base1: darker than solarized-light's border for
      // visible lines, but this also fills surface3 (the user message bubble),
      // which turned into a heavy block at 50%
      border: "#CACCC0",
      // base01: keeps 4.5:1 on control, where base00 drops below it
      mutedForeground: "#586E75",
      accent: "#268BD2",
      // base0: ring also fills foregroundExtraMuted, which base1 leaves near 2.5:1
      ring: "#839496",
    },
  });
  return () => {};
}
