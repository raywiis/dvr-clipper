import { NOISE_THRESHOLD } from "../../analyze";
import type { AppState } from "../../appState";
import { encodeMov } from "../../encode/mov";
import { getSamples } from "../../getSamples";
import { formatTime } from "../../player";
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

type FileListEventMap = {
  [FILE_LIST_SELECT_EVENT]: FileListSelectEvent;
};

type FileListEntry = {
  item: HTMLLIElement;
  status: HTMLSpanElement;
  chart: NoiseChart;
};

export class FileList extends HTMLElement {
  #entries = new Map<File, FileListEntry>();
  #renderedList: HTMLUListElement | null = null;

  connectedCallback() {
    this.#render();
  }

  configure(appState: AppState) {
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
      entry.status.textContent = `${staticPct}% static · ${formatTime(duration)} · ${samples.length} frames`;
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

    const resampleBtn = document.createElement("button");
    resampleBtn.className = styles.action!;
    resampleBtn.type = "button";
    resampleBtn.textContent = "resample";
    resampleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      getSamples(file, () => {})
        .then((samples) => encodeMov([{ file, samples }]))
        .then((file) => {
          file.save("resampled.mov");
        });
    });

    item.append(header, chart, resampleBtn);
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
