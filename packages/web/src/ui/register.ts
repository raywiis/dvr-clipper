import { FileList } from "./FileList/FileList/FileList";
import { FileListItem } from "./FileList/FileListItem/FileListItem";
import { NoiseChart } from "./NoiseChart/NoiseChart";
import { PlayButton } from "./player/PlayButton";
import { Player } from "./player/Player";
import { ScrubTimeline } from "./player/ScrubTimeline";
import { VideoFrameCanvas } from "./player/VideoFrameCanvas";

export function registerCustomElements() {
  window.customElements.define("noise-chart", NoiseChart);
  window.customElements.define("play-button", PlayButton);
  window.customElements.define("scrub-timeline", ScrubTimeline);
  window.customElements.define("video-frame-canvas", VideoFrameCanvas);
  window.customElements.define("video-player", Player);
  window.customElements.define("file-list", FileList);
  window.customElements.define("file-list-item", FileListItem);
}
