import { assert } from "./assert";
import { decodeFrame, type Sample } from "./decode/mjpeg";

export type NoisePoint = {
  /** Presentation time of the sampled frame, in seconds */
  time: number;
  /** White-noise score in [0, 1]; higher means more static-like */
  score: number;
};

/**
 * Frames scoring at or above this are treated as white noise / static. It sits
 * in the gap between clean footage (~0.05) and downscaled snow (~0.4); see the
 * detector-calibration note for why downscaling compresses the static score.
 */
export const NOISE_THRESHOLD = 0.5;

/** Analysis frames are scaled to this width — a low-pass filter on pixel noise. */
const TARGET_WIDTH = 128;

/** Upper bound on frames sampled per file, spread evenly across its duration. */
const MAX_FRAMES = 64 * 10;

/**
 * Reads a file's frames and scores each for white noise. Frames are sampled
 * evenly across the clip (up to MAX_FRAMES) so cost stays bounded regardless of
 * length, while still surfacing where static occurs over time.
 */
export async function analyzeNoise(
  file: File,
  samples: Sample[],
  onProgress: (fraction: number, points: number) => void,
): Promise<NoisePoint[]> {
  if (samples.length === 0) return [];

  const canvas = new OffscreenCanvas(TARGET_WIDTH, TARGET_WIDTH);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  assert(ctx, "No offscreen canvas context for noise analysis");

  const count = Math.min(MAX_FRAMES, samples.length);

  const points: NoisePoint[] = [];

  for (let i = 0; i < count; i++) {
    const index =
      count === 1 ? 0 : Math.round((i / (count - 1)) * (samples.length - 1));
    const { bitmap, time } = await decodeFrame(file, samples[index]!);
    points.push({ time, score: scoreFrame(ctx, canvas, bitmap) });
    bitmap.close();
    onProgress((i + 1) / count, count);
  }

  return points;
}

/**
 * White-noise score for one frame: 1 minus the lag-1 spatial autocorrelation of
 * luma. Static has uncorrelated neighbouring pixels (correlation ≈ 0, score ≈ 1);
 * real footage is smooth and highly correlated (score ≈ 0.05). Flat frames carry
 * no high-frequency energy and score 0 rather than dividing by ~zero variance.
 */
function scoreFrame(
  ctx: OffscreenCanvasRenderingContext2D,
  canvas: OffscreenCanvas,
  bitmap: ImageBitmap,
): number {
  const w = TARGET_WIDTH;
  const h = Math.max(
    1,
    Math.round((bitmap.height / bitmap.width) * TARGET_WIDTH),
  );
  if (canvas.height !== h) canvas.height = h;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const n = w * h;
  const luma = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const y =
      0.299 * data[i * 4]! +
      0.587 * data[i * 4 + 1]! +
      0.114 * data[i * 4 + 2]!;
    luma[i] = y;
    sum += y;
  }
  const mean = sum / n;

  let varSum = 0;
  let covSum = 0;
  let pairs = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = luma[i]! - mean;
      varSum += d * d;
      if (x + 1 < w) {
        covSum += d * (luma[i + 1]! - mean);
        pairs++;
      }
      if (y + 1 < h) {
        covSum += d * (luma[i + w]! - mean);
        pairs++;
      }
    }
  }

  const variance = varSum / n;
  if (variance < 1) return 0; // effectively flat — no texture to be noise
  const correlation = covSum / pairs / variance;
  return Math.max(0, Math.min(1, 1 - correlation));
}
