import { assert } from "../../assert";
import { decodeFrame, type Sample } from "../../decode/mjpeg";
import styles from "./videoFrameCanvas.module.css";

type FrameTarget = {
  file: File;
  sample: Sample;
  index: number;
};

export class VideoFrameCanvas extends HTMLElement {
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #file: File | null = null;
  #samples: Sample[] = [];
  #renderedIndex = -1;
  #pendingTarget: FrameTarget | null = null;
  #drawPromise: Promise<void> | null = null;

  connectedCallback() {
    this.#render();
    if (this.#samples.length > 0 && this.#renderedIndex < 0) {
      void this.showFrame(0);
    }
  }

  configure(file: File, samples: Sample[]) {
    this.#file = file;
    this.#samples = samples;
    this.#renderedIndex = -1;
    this.#pendingTarget = null;

    if (samples.length === 0) {
      this.reset();
      return Promise.resolve();
    }

    if (!this.#canvas || !this.#ctx) {
      return Promise.resolve();
    }

    return this.showFrame(0);
  }

  showFrame(index: number) {
    assert(this.#file, "Video frame canvas is missing a file");
    assert(this.#samples.length > 0, "Video frame canvas has no samples");

    const targetIndex = Math.max(0, Math.min(index, this.#samples.length - 1));
    const sample = this.#samples[targetIndex];
    assert(sample, "Video frame canvas target sample is missing");

    this.#pendingTarget = {
      file: this.#file,
      sample,
      index: targetIndex,
    };
    if (!this.#canvas || !this.#ctx) {
      return Promise.resolve();
    }

    if (!this.#drawPromise) {
      this.#drawPromise = this.#drawPending().finally(() => {
        this.#drawPromise = null;
      });
    }
    return this.#drawPromise;
  }

  reset() {
    this.#file = null;
    this.#samples = [];
    this.#renderedIndex = -1;
    this.#pendingTarget = null;
    if (!this.#canvas || !this.#ctx) {
      return;
    }

    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  #render() {
    if (this.#canvas) {
      return;
    }

    this.classList.add(styles.host!);

    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas!;
    this.append(canvas);
    this.#canvas = canvas;

    const ctx = canvas.getContext("2d");
    assert(ctx, "No video frame canvas context");
    this.#ctx = ctx;
  }

  async #drawPending() {
    while (this.#pendingTarget) {
      const target = this.#pendingTarget;
      this.#pendingTarget = null;

      if (target.index === this.#renderedIndex) {
        continue;
      }

      const frame = await decodeFrame(target.file, target.sample);
      if (!this.#isCurrentTarget(target)) {
        frame.bitmap.close();
        continue;
      }

      this.#drawBitmap(frame.bitmap);
      frame.bitmap.close();
      this.#renderedIndex = target.index;
    }
  }

  #isCurrentTarget(target: FrameTarget) {
    return (
      target.file === this.#file &&
      target.sample === this.#samples[target.index]
    );
  }

  #drawBitmap(bitmap: ImageBitmap) {
    if (!this.#canvas || !this.#ctx) {
      return;
    }

    if (this.#canvas.width !== bitmap.width) {
      this.#canvas.width = bitmap.width;
    }
    if (this.#canvas.height !== bitmap.height) {
      this.#canvas.height = bitmap.height;
    }
    this.#ctx.drawImage(bitmap, 0, 0, this.#canvas.width, this.#canvas.height);
  }
}
