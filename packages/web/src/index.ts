import { assert } from "./assert";
import { select } from "./dom";
import { createPlayer } from "./player";
import {
  FileList as FileListElement,
} from "./ui/FileList/FileList";
import { PlayButton } from "./ui/player/PlayButton";
import { registerCustomElements } from "./ui/register";
import { NoiseChart } from "./ui/NoiseChart/NoiseChart";
import { AppState } from "./appState";

registerCustomElements();

const fileInput = select('.dropzone input[type="file"]', HTMLInputElement);
const errorLabel = select("#dropzone-error", HTMLElement);
const canvas = select("canvas", HTMLCanvasElement);
const scrub = select(".timeline-scrub", HTMLInputElement);
const timeLabel = select(".timeline-time", HTMLElement);
const noiseChart = select(".timeline-noise", NoiseChart);
const playButton = select(".play-button", PlayButton);
const fileList = select(".filelist", FileListElement);

const ctx = canvas.getContext("2d");
assert(ctx, "No canvas context");
const player = { canvas, ctx, scrub, timeLabel, noise: noiseChart, playButton };

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
fileList.addEventListener('file-select', (event) => {
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
