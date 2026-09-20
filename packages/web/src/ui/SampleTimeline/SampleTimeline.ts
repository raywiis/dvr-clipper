import type { AppState } from "../../appState";
import { assert } from "../../assert";
import { getNoiselessGroupsFromFiles } from "../../getNoiselessGroupsFromFiles";
import styles from "./sampleTimeline.module.css";

export type SampleTimelineBlock = {
  start: number;
  duration: number;
};

export class SampleTimeline extends HTMLElement {
  file: File | null = null;
  #blocks: SampleTimelineBlock[] = [];
  #appState: AppState | null = null;
  #bar: HTMLElement | null = null;

  connectedCallback() {
    this.#render();
  }

  configure(appState: AppState) {
    this.#appState = appState;
  }

  setFile(file: File) {
    this.file = file;
    this.#blocks = this.#getBlocks(file);
    this.#renderBlocks();
  }

  #render() {
    if (this.#bar) {
      return;
    }

    this.classList.add(styles.host!);

    const bar = document.createElement("div");
    bar.className = styles.bar!;
    this.append(bar);
    this.#bar = bar;
  }

  #getBlocks(file: File): SampleTimelineBlock[] {
    assert(this.#appState, "Sample timeline is not configured");
    const groups = this.#appState.fileNoiseGroups.get(file);
    if (!groups) {
      return [];
    }
    const blocks: SampleTimelineBlock[] = [];

    for (const group of groups) {
      const firstSample = group.at(0)?.samples.at(0);
      const lastSample = group.at(-1)?.samples.at(-1);
      assert(firstSample, "No first sample in noiseless group");
      assert(lastSample, "No last sample in noiseless group");

      blocks.push({
        start: firstSample.time,
        duration: lastSample.time - firstSample.time,
      });
    }

    return blocks;
  }

  #renderBlocks() {
    this.#render();
    assert(this.#bar, "Sample timeline bar is not initialized");
    this.#bar.replaceChildren();

    assert(this.#appState, "Sample timeline is not configured");
    assert(this.file, "Sample timeline has no file");
    const samples = this.#appState.fileSamples.get(this.file);
    assert(samples, "Missing samples for sample timeline");
    const fileDuration = samples.at(-1)?.time ?? 0;
    if (fileDuration <= 0) {
      return;
    }

    for (const block of this.#blocks) {
      const line = document.createElement("div");
      line.className = styles.block!;
      line.style.left = `${(block.start / fileDuration) * 100}%`;
      line.style.width = `${(block.duration / fileDuration) * 100}%`;
      this.#bar.append(line);
    }
  }
}
