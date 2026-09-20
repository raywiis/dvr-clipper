import { AppState } from "./appState";
import { select } from "./dom";
import { encodeMov } from "./encode/mov";
import {
  EXPORT_VIDEOS_REQUEST_EVENT,
  ExportedVideos,
  ExportVideosRequestEvent,
} from "./ui/ExportedVideos/ExportedVideos";
import { FileList as FileListElement } from "./ui/FileList/FileList/FileList";
import { Player } from "./ui/player/Player";
import { registerCustomElements } from "./ui/register";

registerCustomElements();

const fileInput = select('.dropzone input[type="file"]', HTMLInputElement);
const errorLabel = select("#dropzone-error", HTMLElement);
const player = select("video-player", Player);
const fileList = select(".filelist", FileListElement);
const exportedVideos = select("exported-videos", ExportedVideos);

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
exportedVideos.configure(state);
player.configure(state);

state.addEventListener("ui:selectFile", (event) => {
  const { file } = event;
  const samples = state.fileSamples.get(file);
  const noise = state.fileNoise.get(file);
  if (!samples || !noise) return;
  void player.load(file, samples, noise);
});

fileInput.addEventListener("input", () => {
  if (fileInput.files) {
    handleFiles(fileInput.files);
  }
});

exportedVideos.addEventListener(EXPORT_VIDEOS_REQUEST_EVENT, (event) => {
  if (!(event instanceof ExportVideosRequestEvent)) {
    return;
  }
  const everythingIsProcessed = state.files.every(
    (file) => state.fileSamples.has(file) && state.fileNoise.has(file),
  );
  if (state.files.length === 0 || !everythingIsProcessed) {
    errorLabel.textContent = "Wait for every video in the batch to finish";
    return;
  }
  errorLabel.textContent = "";

  event.detail.groups.forEach((group, index) => {
    const now = new Date();
    const isoString = now.toISOString();
    const prefix = isoString.split('T').at(0);
    encodeMov(group)
      .then((file) => {
        file.save(`${prefix}_${index + 1}.mov`);
      })
      .catch((err) => {
        console.error("Failed to reencode", err);
      });
  });
});

// @ts-expect-error
window.appState = state;
