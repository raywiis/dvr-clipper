import { type NoisePoint } from "./analyze";
import { decodeFrame, type Sample } from "./decode/mjpeg";
import { renderNoiseChart } from "./noiseChart";

export type PlayerElements = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scrub: HTMLInputElement;
  timeLabel: HTMLElement;
  noise: SVGElement;
};

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function createPlayer(els: PlayerElements, file: File, samples: Sample[], noise: NoisePoint[]) {
  const { canvas, ctx, scrub, timeLabel } = els;

  renderNoiseChart(els.noise, noise);

  const first = await decodeFrame(file, samples[0]!);
  canvas.width = first.bitmap.width;
  canvas.height = first.bitmap.height;
  ctx.drawImage(first.bitmap, 0, 0, canvas.width, canvas.height);
  first.bitmap.close();

  const lastFrame = samples.length - 1;
  const duration = samples[lastFrame]!.time;

  scrub.min = '0';
  scrub.max = String(lastFrame);
  scrub.step = '1';
  scrub.value = '0';
  scrub.disabled = false;
  timeLabel.textContent = `${formatTime(0)} / ${formatTime(duration)}`;

  let rendered = 0;
  let pending: number | null = null;
  let busy = false;

  async function seekTo(index: number) {
    pending = index;
    if (busy) return;
    busy = true;
    while (pending !== null) {
      const target = pending;
      pending = null;
      if (target === rendered) continue;
      const frame = await decodeFrame(file, samples[target]!);
      ctx.drawImage(frame.bitmap, 0, 0, canvas.width, canvas.height);
      frame.bitmap.close();
      rendered = target;
    }
    busy = false;
  }

  // Assignment, not addEventListener: loading a different file re-runs
  // createPlayer, and we want the new closure to replace the old handler
  // rather than stack another listener on the shared scrub element.
  scrub.oninput = () => {
    const index = Number(scrub.value);
    timeLabel.textContent = `${formatTime(samples[index]!.time)} / ${formatTime(duration)}`;
    seekTo(index);
  };
}
