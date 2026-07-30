import { FileList } from "./FileList/FileList";
import { NoiseChart } from "./NoiseChart/NoiseChart";
import { PlayButton } from "./player/PlayButton";

export function registerCustomElements() {
  window.customElements.define("noise-chart", NoiseChart);
  window.customElements.define("play-button", PlayButton);
  window.customElements.define("file-list", FileList);
}
