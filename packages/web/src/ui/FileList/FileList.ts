import { NOISE_THRESHOLD } from "../../analyze";
import type { AppState } from "../../appState";
import { assert } from "../../assert";
import type { Sample } from "../../decode/mjpeg";
import { encodeMov } from "../../encode/mov";
import { formatDuration } from "../../formatDuration";
import { NoiseChart } from "../NoiseChart/NoiseChart";
import styles from "./fileList.module.css";

export const FILE_LIST_SELECT_EVENT = "file-select";

export class FileListSelectEvent extends CustomEvent<{ file: File }> {
  constructor(file: File) {
    super(FILE_LIST_SELECT_EVENT, {
      bubbles: true,
      detail: { file },
    });
  }
}

function getNoiselessGroupsFromFile(
  appState: AppState,
  file: File,
): Sample[][] {
  let groups: Sample[][] = [];
  let iteratorState:
    { recording: true; lastClearFrame: number } | { recording: false } = {
    recording: false,
  };

  const noiseThreshold = 0.5;
  const clearFrameTimeThreshold = 20;

  const samples = appState.fileSamples.get(file);
  const noise = appState.fileNoise.get(file);

  assert(samples, "Missing samples");
  assert(noise, "Missing video noise");

  let noiseIterator = noise[Symbol.iterator]();
  let noisePoint = noiseIterator.next();
  assert(!noisePoint.done, "No noise in the iterator");

  for (const sample of samples) {
    if (!iteratorState.recording && noisePoint.value.score < noiseThreshold) {
      iteratorState = {
        recording: true,
        lastClearFrame: sample.time,
      };
      groups.push([]);
    }

    if (iteratorState.recording) {
      const latestGroup = groups.at(-1);
      assert(latestGroup, "No last group");
      latestGroup.push(sample);

      if (noisePoint.value.score < noiseThreshold) {
        iteratorState.lastClearFrame = sample.time;
      }

      const clearFrameDelta = sample.time - iteratorState.lastClearFrame;
      if (clearFrameDelta > clearFrameTimeThreshold) {
        iteratorState = { recording: false };
        console.log("group closed");
      }
    }

    if (noisePoint.value.time < sample.time) {
      noisePoint = noiseIterator.next();
    }
    assert(!noisePoint.done, "Abrupt noise end");
  }

  return groups;
}

type FileListEventMap = {
  [FILE_LIST_SELECT_EVENT]: FileListSelectEvent;
};

type FileListEntry = {
  item: HTMLLIElement;
  status: HTMLSpanElement;
  chart: NoiseChart;
};

export class FileList extends HTMLElement {
  #appState: AppState | null = null;
  #entries = new Map<File, FileListEntry>();
  #renderedList: HTMLUListElement | null = null;

  connectedCallback() {
    this.#render();
  }

  configure(appState: AppState) {
    this.#appState = appState;
    this.#render();
    for (const file of appState.files) {
      this.#renderFile(file);
    }

    appState.addEventListener("ui:addFile", (event) => {
      this.#renderFile(event.addedFile);
    });

    appState.addEventListener("file:statusChange", (event) => {
      const entry = this.#entries.get(event.file);
      if (!entry) {
        return;
      }
      entry.status.textContent = event.status;
    });

    appState.addEventListener("file:noise:added", (event) => {
      const entry = this.#entries.get(event.file);
      if (!entry) {
        return;
      }

      const noise = event.noisePoints;
      entry.chart.setNoisePoints(noise);
      const noisyFrames = noise.filter(
        (point) => point.score >= NOISE_THRESHOLD,
      ).length;
      const staticPct = noise.length
        ? Math.round((noisyFrames / noise.length) * 100)
        : 0;
      const samples = appState.fileSamples.get(event.file);
      if (!samples) {
        return;
      }
      const duration = samples[samples.length - 1]?.time ?? 0;
      this.#setProgress(entry.item, 1);
      entry.item.classList.add(styles.isReady!);
      entry.status.textContent = `${staticPct}% static · ${formatDuration(duration)} · ${samples.length} frames`;
    });

    appState.addEventListener("file:progress", (event) => {
      const entry = this.#entries.get(event.file);
      if (!entry) {
        return;
      }
      this.#setProgress(entry.item, event.progress);
    });

    appState.addEventListener("file:error", (event) => {
      const entry = this.#entries.get(event.file);
      if (!entry) {
        return;
      }
      this.#setProgress(entry.item, 1);
      entry.item.classList.add(styles.isError!);
      entry.status.textContent = event.message;
    });
  }

  addEventListener<K extends keyof FileListEventMap>(
    type: K,
    listener: (this: FileList, event: FileListEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) {
      return;
    }
    super.addEventListener(type, listener, options);
  }

  #render() {
    if (this.#renderedList) {
      return;
    }

    this.classList.add(styles.host!);

    const list = document.createElement("ul");
    list.className = styles.list!;
    this.append(list);
    this.#renderedList = list;
  }

  #renderFile(file: File) {
    if (this.#entries.has(file)) {
      return;
    }

    this.#render();
    if (!this.#renderedList) {
      return;
    }

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

    const appState = this.#appState;
    if (appState) {
      const resampleBtn = document.createElement("button");
      resampleBtn.className = styles.action!;
      resampleBtn.type = "button";
      resampleBtn.textContent = "resample";
      resampleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        const samples = appState.fileSamples.get(file);
        if (!samples) {
          return;
        }
        encodeMov([{ file, samples }]).then((file) => {
          file.save("resampled.mov");
        });
      });

      const getClipsWithoutNoiseBtn = document.createElement("button");
      getClipsWithoutNoiseBtn.className = styles.action!;
      getClipsWithoutNoiseBtn.type = "button";
      getClipsWithoutNoiseBtn.textContent = "get clips without noise";
      getClipsWithoutNoiseBtn.addEventListener("click", (event) => {
        event.stopPropagation();

        const groups = getNoiselessGroupsFromFile(appState, file);
        for (const group of groups) {
          encodeMov([{ file, samples: group }])
            .then((file) => {
              file.save("thing");
            })
            .catch((err) => {
              console.error("Failed to reencode", err);
            });
        }
      });

      item.append(resampleBtn, getClipsWithoutNoiseBtn);
    }
    item.addEventListener("click", () => {
      this.dispatchEvent(new FileListSelectEvent(file));
    });

    this.#renderedList.append(item);
    this.#entries.set(file, { item, status, chart });
  }

  #setProgress(item: HTMLElement, fraction: number) {
    const clamped = Math.max(0, Math.min(1, fraction));
    item.style.setProperty("--progress", String(clamped));
  }
}
