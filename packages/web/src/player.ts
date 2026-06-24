import { type NoisePoint } from "./analyze";
import type { NoiseChart } from "./ui/NoiseChart/NoiseChart";
import type { PlayButton } from "./ui/player/playButton";
import { decodeFrame, type Sample } from "./decode/mjpeg";

export type PlayerElements = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scrub: HTMLInputElement;
  timeLabel: HTMLElement;
  noise: NoiseChart;
  playButton: PlayButton;
};

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Stops playback from a previously loaded file: createPlayer re-runs per file
// but they share one canvas/scrub, so a stale rAF loop would keep drawing.
let stopActivePlayback: (() => void) | null = null;

export async function createPlayer(els: PlayerElements, file: File, samples: Sample[], noise: NoisePoint[]) {
  const { canvas, ctx, scrub, timeLabel, playButton } = els;

  stopActivePlayback?.();
  els.noise.setNoisePoints(noise);

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

  /** Largest sample index whose presentation time is <= t (binary search). */
  function indexAtTime(t: number): number {
    if (t <= samples[0]!.time) return 0;
    if (t >= samples[lastFrame]!.time) return lastFrame;
    let lo = 0;
    let hi = lastFrame;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (samples[mid]!.time <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  function showFrame(index: number) {
    scrub.value = String(index);
    timeLabel.textContent = `${formatTime(samples[index]!.time)} / ${formatTime(duration)}`;
    seekTo(index);
  }

  // Playback advances by wall-clock time against the samples' own timestamps, so
  // it tracks the clip's real frame rate and drops frames if decoding lags.
  let playing = false;
  let rafId = 0;
  let anchorWall = 0; // performance.now() when playback (re)started
  let anchorTime = 0; // clip time at that moment

  function tick() {
    if (!playing) return;
    const elapsed = anchorTime + (performance.now() - anchorWall) / 1000;
    showFrame(indexAtTime(elapsed));
    if (elapsed >= duration) {
      pause();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    // Restart from the beginning if we're parked at the end.
    const startIndex = Number(scrub.value) >= lastFrame ? 0 : Number(scrub.value);
    anchorTime = samples[startIndex]!.time;
    anchorWall = performance.now();
    playing = true;
    playButton.play();
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(rafId);
    playButton.pause()
  }

  stopActivePlayback = pause;

  playing = false;
  playButton.pause();

  playButton.onclick = () => (playing ? pause() : play());

  // Assignment, not addEventListener: loading a different file re-runs
  // createPlayer, and we want the new closure to replace the old handler
  // rather than stack another listener on the shared scrub element.
  scrub.oninput = () => {
    const index = Number(scrub.value);
    // Re-anchor so playback continues smoothly from where the user dragged.
    anchorTime = samples[index]!.time;
    anchorWall = performance.now();
    showFrame(index);
  };
}
