import type { Preview } from "@storybook/html-vite";
import { registerCustomElements } from "../src/ui/register";
import "../src/ui/NoiseChart/noiseChart.module.css";
import "../src/index.css";

registerCustomElements();

const preview: Preview = {
  parameters: {
    layout: "centered",
  },
};

export default preview;
