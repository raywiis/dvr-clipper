import { AppState } from "./appState";
import { select } from "./dom";
import { createPlayer } from "./player";
import { FileList as FileListElement } from "./ui/FileList/FileList";
import { NoiseChart } from "./ui/NoiseChart/NoiseChart";
import { PlayButton } from "./ui/player/PlayButton";
import { ScrubTimeline } from "./ui/player/ScrubTimeline";
import { VideoFrameCanvas } from "./ui/player/VideoFrameCanvas";
import { registerCustomElements } from "./ui/register";

registerCustomElements();

const fileInput = select('.dropzone input[type="file"]', HTMLInputElement);
const errorLabel = select("#dropzone-error", HTMLElement);
const frameCanvas = select("video-frame-canvas", VideoFrameCanvas);
const timeline = select(".timeline-scrub", ScrubTimeline);
const noiseChart = select(".timeline-noise", NoiseChart);
const playButton = select(".play-button", PlayButton);
const fileList = select(".filelist", FileListElement);

const player = { frameCanvas, timeline, noise: noiseChart, playButton };

const state = new AppState();

async function handleFiles(newFiles: FileList) {
  for (const file of newFiles) {
    state.addFile(file);
  }

  const files = [...state.files];
  if (files.length === 0) {
    errorLabel.textContent = "No files found in dropped input";
    return;
  }
  errorLabel.textContent = "";
}

fileList.configure(state);
fileList.addEventListener("file-select", (event) => {
  const { file } = event.detail;
  const samples = state.fileSamples.get(file);
  if (!samples) return;
  const noise = state.fileNoise.get(file) ?? [];
  createPlayer(player, file, samples, noise);
});

fileInput.addEventListener("input", () => {
  if (fileInput.files) {
    handleFiles(fileInput.files);
  }
});
