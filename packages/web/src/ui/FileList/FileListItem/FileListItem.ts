import { NOISE_THRESHOLD } from "../../../analyze";
import { AppUISelectFileEvent, type AppState } from "../../../appState";
import { assert } from "../../../assert";
import type { Sample } from "../../../decode/mjpeg";
import { encodeMov } from "../../../encode/mov";
import { formatDuration } from "../../../formatDuration";
import { getNoiselessGroupsFromFiles } from "../../../getNoiselessGroupsFromFiles";
import { NoiseChart } from "../../NoiseChart/NoiseChart";
import styles from "./fileListItem.module.css";

function getNoiselessGroupsFromFile(
  appState: AppState,
  file: File,
): Sample[][] {
  const groups = getNoiselessGroupsFromFiles(appState, [file]);
  return groups.map((sections) => {
    assert(sections.length === 1, "Multiple sections from a single file");
    return sections.flatMap((section) => section.samples);
  });
}

export class FileListItem extends HTMLElement {
  #appState: AppState;
  #file: File;

  constructor(appState: AppState, file: File) {
    super();
    this.#appState = appState;
    this.#file = file;
  }

  connectedCallback() {
    this.#render();
  }

  #render() {
    const item = document.createElement("li");
    item.className = styles.item!;
    item.style.setProperty("--progress", "0");

    const header = document.createElement("div");
    header.className = styles.header!;

    const name = document.createElement("span");
    name.className = styles.name!;
    name.textContent = this.#file.name;

    const status = document.createElement("span");
    status.className = styles.status!;
    status.textContent = "Queued";

    header.append(name, status);

    const chart = new NoiseChart();

    item.append(header, chart);

    item.draggable = true;
    // TODO: Make this more animated
    item.addEventListener("dragstart", (event) => {
      console.log("dragstart on " + this.#file.name, event);
    });
    item.addEventListener("drag", (event) => {
      console.log("drag", event);
    });
    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      console.log("dragover on " + this.#file.name, event);
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      console.log("dropped on " + this.#file.name, event);
    });

    const resampleBtn = document.createElement("button");
    resampleBtn.className = styles.action!;
    resampleBtn.type = "button";
    resampleBtn.textContent = "Resample whole file";
    resampleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const samples = this.#appState.fileSamples.get(this.#file);
      if (!samples) {
        return;
      }
      encodeMov([{ file: this.#file, samples }]).then((file) => {
        file.save("resampled.mov");
      });
    });

    const getClipsWithoutNoiseBtn = document.createElement("button");
    getClipsWithoutNoiseBtn.className = styles.action!;
    getClipsWithoutNoiseBtn.type = "button";
    getClipsWithoutNoiseBtn.textContent = "Get clips between the noise";
    getClipsWithoutNoiseBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      const groups = getNoiselessGroupsFromFile(this.#appState, this.#file);
      for (const group of groups) {
        encodeMov([{ file: this.#file, samples: group }])
          .then((file) => {
            file.save("thing");
          })
          .catch((err) => {
            console.error("Failed to reencode", err);
          });
      }
    });

    item.append(resampleBtn, getClipsWithoutNoiseBtn);
    item.addEventListener("click", () => {
      this.#appState.eventTarget.dispatchEvent(
        new AppUISelectFileEvent(this.#file),
      );
    });

    const setProgress = (fraction: number) => {
      const clamped = Math.max(0, Math.min(1, fraction));
      item.style.setProperty("--progress", String(clamped));
    };

    this.#appState.addEventListener("file:statusChange", (event) => {
      if (event.file !== this.#file) {
        return;
      }
      status.textContent = event.status;
    });

    this.#appState.addEventListener("file:progress", (event) => {
      if (event.file !== this.#file) {
        return;
      }
      setProgress(event.progress);
    });

    this.#appState.addEventListener("file:error", (event) => {
      if (event.file !== this.#file) {
        return;
      }
      setProgress(1);
      item.classList.add(styles.isError!);
      status.textContent = event.message;
    });

    this.#appState.addEventListener("file:noise:added", (event) => {
      if (event.file !== this.#file) {
        return;
      }

      const noise = event.noisePoints;
      chart.setNoisePoints(noise);
      const noisyFrames = noise.filter(
        (point) => point.score >= NOISE_THRESHOLD,
      ).length;
      const staticPct = noise.length
        ? Math.round((noisyFrames / noise.length) * 100)
        : 0;
      const samples = this.#appState.fileSamples.get(event.file);
      if (!samples) {
        return;
      }
      const duration = samples[samples.length - 1]?.time ?? 0;

      setProgress(1);
      item.classList.add(styles.isReady!);
      status.textContent = `${staticPct}% static · ${formatDuration(duration)} · ${samples.length} frames`;
    });

    this.append(item);
  }
}
