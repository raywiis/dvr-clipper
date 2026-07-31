import { AppState } from "./appState";
import { select } from "./dom";
import { FileList as FileListElement } from "./ui/FileList/FileList";
import { Player } from "./ui/player/Player";
import { registerCustomElements } from "./ui/register";

registerCustomElements();

const fileInput = select('.dropzone input[type="file"]', HTMLInputElement);
const errorLabel = select("#dropzone-error", HTMLElement);
const player = select("video-player", Player);
const fileList = select(".filelist", FileListElement);

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
  void player.load(file, samples, noise);
});

fileInput.addEventListener("input", () => {
  if (fileInput.files) {
    handleFiles(fileInput.files);
  }
});
