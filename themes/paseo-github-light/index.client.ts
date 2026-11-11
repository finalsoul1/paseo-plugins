import type { PluginClientContext } from "@getpaseo/plugin/client";

// Values come from @primer/primitives dist/css/functional/themes/light.css.
// Paseo expands these eight keys into a larger token set, so the comments below
// record which derived token forced a value away from the obvious source color.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "github-light",
    name: "GitHub Light",
    appearance: "light",
    colors: {
      background: "#FFFFFF",
      foreground: "#1F2328",
      raised: "#F6F8FA",
      // control-bgColor-hover, not control-bgColor-rest: rest equals bgColor-muted,
      // and raised also fills hovered sidebar rows, so the two have to differ
      control: "#EFF2F5",
      border: "#D1D9E0",
      mutedForeground: "#59636E",
      accent: "#0969DA",
      // borderColor-emphasis: ring also fills foregroundExtraMuted and terminalBrightBlack
      ring: "#818B98",
    },
  });
  return () => {};
}
