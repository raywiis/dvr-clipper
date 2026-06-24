import { analyzeNoise, NOISE_THRESHOLD, type NoisePoint } from './analyze';
import { assert } from './assert';
import { select } from './dom';
import { type Sample } from './decode/mjpeg';
import { createPlayer, formatTime } from './player';
import { renderFileList } from './fileList';
import { getSamples } from './showVideo';
import { PlayButton } from './components/player/playButton';
import { registerCustomElements } from './components/register';
import { NoiseChart } from './components/NoiseChart/NoiseChart';

registerCustomElements();

const fileInput = select('.dropzone input[type="file"]', HTMLInputElement);
const errorLabel = select('#dropzone-error', HTMLElement);
const canvas = select('canvas', HTMLCanvasElement);
const scrub = select('.timeline-scrub', HTMLInputElement);
const timeLabel = select('.timeline-time', HTMLElement);
const noiseChart = select('.timeline-noise', NoiseChart);
const playButton = select('.play-button', PlayButton);
const listEl = select('.filelist', HTMLUListElement);

const ctx = canvas.getContext('2d');
assert(ctx, 'No canvas context');
const player = { canvas, ctx, scrub, timeLabel, noise: noiseChart, playButton };

class AppState {
  files: File[] = []
  fileSamples: Map<File, Sample[]> = new Map();

  addFile(file: File) {
    if (this.hasFile(file)) {
      return;
    }
    this.files.push(file);
  }

  hasFile(file: File) {
    return this.files.some(existingFile => existingFile.name === file.name);
  }
}

const state = new AppState();

async function handleFiles(newFiles: FileList) {
  for (const file of newFiles) {
    state.addFile(file);
  }

  const files = [...state.files];
  if (files.length === 0) {
    errorLabel.textContent = 'No files found in dropped input';
    return;
  }
  errorLabel.textContent = '';

  const noiseByFile = new Map<File, NoisePoint[]>();
  let active: File | null = null;

  const rows = renderFileList(listEl, files, (file) => {
    const samples = state.fileSamples.get(file);
    if (!samples) return; // still reading or failed
    active = file;
    rows.forEach((row, i) => row.setActive(files[i] === file));
    createPlayer(player, file, samples, noiseByFile.get(file) ?? []);
  });

  for (const [index, file] of files.entries()) {
    const row = rows[index]!;
    try {
      row.setStatus('Reading…');
      row.setProgress(0.1);
      const knownSamples = state.fileSamples.get(file);
      const samples = knownSamples ?? await getSamples(file, (progress) => row.setProgress(progress * 0.45 + 0.1));
      state.fileSamples.set(file, samples);
      const duration = samples[samples.length - 1]?.time ?? 0;

      // Show the first readable file right away; the per-frame analysis below is
      // slower and runs after the video is on screen, filling in the overlay.
      if (!active) {
        active = file;
        row.setActive(true);
        await createPlayer(player, file, samples, []);
      }

      row.setStatus('Analyzing…');
      const noise = await analyzeNoise(file, samples, (progress) => row.setProgress(progress * 0.45 + 0.55));
      noiseByFile.set(file, noise);
      row.setNoise(noise);
      if (active === file) noiseChart.setNoisePoints(noise);

      const noisyFrames = noise.filter((point) => point.score >= NOISE_THRESHOLD).length;
      const staticPct = noise.length ? Math.round((noisyFrames / noise.length) * 100) : 0;
      row.setReady(`${staticPct}% static · ${formatTime(duration)} · ${samples.length} frames`);
    } catch (err) {
      row.setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!active) {
    errorLabel.textContent = 'None of the dropped files could be read';
  }
}

fileInput.addEventListener('input', () => {
  if (fileInput.files) {
    handleFiles(fileInput.files);
  }
});
