import { AppState } from "./appState";
import { select } from "./dom";
import { encodeMov } from "./encode/mov";
import { getNoiselessGroupsFromFiles } from "./getNoiselessGroupsFromFiles";
import { FileList as FileListElement } from "./ui/FileList/FileList/FileList";
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

state.addEventListener("ui:selectFile", (event) => {
  const { file } = event;
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

const extractAllBtn = select("#extract-all-clips", HTMLButtonElement);
extractAllBtn.addEventListener("click", () => {
  const readyFiles = state.files.filter(
    (file) => state.fileSamples.has(file) && state.fileNoise.has(file),
  );
  if (readyFiles.length === 0) {
    errorLabel.textContent = "No analyzed videos to process";
    return;
  }
  errorLabel.textContent = "";

  const groups = getNoiselessGroupsFromFiles(state, readyFiles);
  groups.forEach((group, index) => {
    encodeMov(group)
      .then((file) => {
        file.save(`combined-clip-${index + 1}.mov`);
      })
      .catch((err) => {
        console.error("Failed to reencode", err);
      });
  });
});

// @ts-expect-error
window.appState = state;
