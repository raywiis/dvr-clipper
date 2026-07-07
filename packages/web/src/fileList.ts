import { NOISE_THRESHOLD } from "./analyze";
import type { AppState } from "./appState";
import styles from "./fileList.module.css";
import { formatTime } from "./player";
import { NoiseChart } from "./ui/NoiseChart/NoiseChart";

export function renderFileListItem(
  container: HTMLUListElement,
  appState: AppState,
  file: File,
  onSelect: (file: File) => void,
) {
  const item = document.createElement("li");
  item.className = styles.item!;
  item.style.setProperty("--progress", "0");

  const header = document.createElement("div");
  header.className = styles.header!;

  const name = document.createElement("span");
  name.className = styles.name!;
  name.textContent = file.name;

  const status = document.createElement("span");
  status.className = styles.status!;
  status.textContent = "Queued";

  header.append(name, status);

  const chart = new NoiseChart();

  item.append(header, chart);
  container.append(item);

  item.addEventListener("click", () => onSelect(file));

  const setProgress = (fraction: number) => {
    const clamped = Math.max(0, Math.min(1, fraction));
    item.style.setProperty("--progress", String(clamped));
  };

  appState.addEventListener("file:statusChange", (event) => {
    if (event.file !== file) {
      return;
    }
    status.textContent = event.status;
  });

  appState.addEventListener("file:noise:added", (event) => {
    if (event.file !== file) {
      return;
    }
    const noise = event.noisePoints;
    chart.setNoisePoints(event.noisePoints);
    const noisyFrames = noise.filter(
      (point) => point.score >= NOISE_THRESHOLD,
    ).length;
    const staticPct = noise.length
      ? Math.round((noisyFrames / noise.length) * 100)
      : 0;
    const samples = appState.fileSamples.get(file);
    if (!samples) {
      return;
    }
    const duration = samples[samples.length - 1]?.time ?? 0;
    setProgress(1);
    item.classList.add(styles.isReady!);
    status.textContent = `${staticPct}% static · ${formatTime(duration)} · ${samples.length} frames`;
  });

  appState.addEventListener("file:progress", (event) => {
    if (event.file !== file) {
      return;
    }
    setProgress(event.progress);
  });

  appState.addEventListener("file:error", (event) => {
    if (event.file !== file) {
      return;
    }
    setProgress(1);
    item.classList.add(styles.isError!);
    status.textContent = event.message;
  });

  return item;
}

export function renderFileList(
  container: HTMLUListElement,
  appState: AppState,
  onSelect: (file: File) => void,
) {
  container.classList.add(styles.list!);

  appState.addEventListener("addFile", (event) => {
    renderFileListItem(container, appState, event.addedFile, onSelect);
  });
}
