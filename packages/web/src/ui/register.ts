import { NoiseChart } from "./NoiseChart/NoiseChart";
import { PlayButton } from "./player/playButton";

export function registerCustomElements() {
  window.customElements.define('noise-chart', NoiseChart);
  window.customElements.define('play-button', PlayButton);
}
