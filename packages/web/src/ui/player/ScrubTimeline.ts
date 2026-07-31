import { assert } from "../../assert";
import { formatDuration } from "../../formatDuration";
import styles from "./scrubTimeline.module.css";

export class ScrubTimeline extends HTMLElement {
  #scrub: HTMLInputElement | null = null;
  #timeLabel: HTMLElement | null = null;
  #duration = 0;

  connectedCallback() {
    this.#render();
  }

  get value() {
    return Number(this.#getScrub().value);
  }

  configure(lastFrame: number, duration: number) {
    const scrub = this.#getScrub();
    this.#duration = duration;
    scrub.min = "0";
    scrub.max = String(lastFrame);
    scrub.step = "1";
    scrub.value = "0";
    scrub.disabled = false;
    this.seek(0);
  }

  seek(currentTime: number, frameIndex = this.value) {
    const scrub = this.#getScrub();
    const timeLabel = this.#getTimeLabel();
    scrub.value = String(frameIndex);
    timeLabel.textContent = `${formatDuration(currentTime)} / ${formatDuration(
      this.#duration,
    )}`;
  }

  reset() {
    const scrub = this.#getScrub();
    this.#duration = 0;
    scrub.min = "0";
    scrub.max = "0";
    scrub.step = "1";
    scrub.value = "0";
    scrub.disabled = true;
    this.#getTimeLabel().textContent = "0:00 / 0:00";
  }

  #render() {
    if (this.#scrub) {
      return;
    }

    this.classList.add(styles.host!);

    const scrub = document.createElement("input");
    scrub.className = styles.scrub!;
    scrub.type = "range";
    scrub.min = "0";
    scrub.max = "0";
    scrub.step = "1";
    scrub.value = "0";
    scrub.disabled = true;

    const timeLabel = document.createElement("span");
    timeLabel.className = styles.time!;
    timeLabel.textContent = "0:00 / 0:00";

    this.append(scrub, timeLabel);
    this.#scrub = scrub;
    this.#timeLabel = timeLabel;
  }

  #getScrub() {
    this.#render();
    assert(this.#scrub, "Scrub timeline is not initialized");
    return this.#scrub;
  }

  #getTimeLabel() {
    this.#render();
    assert(this.#timeLabel, "Scrub timeline is not initialized");
    return this.#timeLabel;
  }
}
