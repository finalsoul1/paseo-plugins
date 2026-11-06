import type { PluginClientContext } from "@getpaseo/plugin/client";

// Values come from morhetz/gruvbox colors/gruvbox.vim (light, medium contrast).
// Paseo expands these eight keys into a larger token set, so the comments below
// record which derived token decided between neighboring palette colors.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "gruvbox-light",
    name: "Gruvbox Light",
    appearance: "light",
    colors: {
      background: "#FBF1C7",
      foreground: "#3C3836",
      // light0_soft; raised also fills hovered sidebar rows, so it has to differ from control
      raised: "#F2E5BC",
      // light1: surfaceSidebar in light themes
      control: "#EBDBB2",
      // light2, not light3: this also fills surface3, where darker reads heavy
      border: "#D5C4A1",
      mutedForeground: "#7C6F64",
      // faded_blue: the neutral accents are too light for buttons on light0
      accent: "#076678",
      // gray, which gruvbox also uses as terminal bright black
      ring: "#928374",
    },
  });
  return () => {};
}
