import type { PluginClientContext } from "@getpaseo/plugin/client";

// Gruvbox Light with background saturation halved (HSL, lightness kept), so the
// surfaces read as warm paper instead of yellow. Text, accent, and ring keep the
// gruvbox-light plugin's values.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "gruvbox-paper",
    name: "Gruvbox Paper",
    appearance: "light",
    colors: {
      // light0_hard rather than light0: the hard background is already the least yellow
      background: "#F1EFDF",
      foreground: "#3C3836",
      // light0; raised also fills hovered sidebar rows, so it has to differ from control
      raised: "#EEE9D4",
      // light0_soft: surfaceSidebar in light themes
      control: "#E4DECA",
      // midpoint of light1 and light2: light1 sits too close to control for visible
      // lines, and light2 also fills surface3 (the user message bubble) too heavily
      border: "#D3CBB7",
      mutedForeground: "#7C6F64",
      accent: "#076678",
      ring: "#928374",
    },
  });
  return () => {};
}
