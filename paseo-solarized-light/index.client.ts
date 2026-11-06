import type { PluginClientContext } from "@getpaseo/plugin/client";

// Values come from altercation/solarized vim-colors-solarized/colors/solarized.vim.
// Solarized has only two light background tones, fewer than Paseo's surfaces need,
// so two values below are blends rather than palette colors.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "solarized-light",
    name: "Solarized Light",
    appearance: "light",
    colors: {
      background: "#FDF6E3",
      // base01, one step darker than the canonical base00 body text: base00 then
      // serves as mutedForeground, where base0 would fall to about 3:1 contrast
      foreground: "#586E75",
      // midpoint of base3 and base2; raised also fills hovered sidebar rows,
      // so it has to differ from control
      raised: "#F6EFDC",
      // base2: surfaceSidebar in light themes
      control: "#EEE8D5",
      // base2 mixed 30% toward base1: base1 itself also fills surface3,
      // where it reads as a heavy block
      border: "#D3D3C5",
      mutedForeground: "#657B83",
      accent: "#268BD2",
      // base1, the comment color: ring also fills foregroundExtraMuted
      ring: "#93A1A1",
    },
  });
  return () => {};
}
