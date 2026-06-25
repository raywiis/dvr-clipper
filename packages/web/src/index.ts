import { analyzeNoise, NOISE_THRESHOLD, type NoisePoint } from './analyze';
import { assert } from './assert';
import { select } from './dom';
import { createPlayer, formatTime } from './player';
import { renderFileList } from './fileList';
import { getSamples } from './getSamples';
import { PlayButton } from './ui/player/PlayButton';
import { registerCustomElements } from './ui/register';
import { NoiseChart } from './ui/NoiseChart/NoiseChart';
import { AppFileNoiseAddedEvent, AppFileStatusChangeEvent, AppState } from './appState';

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

  const rows = renderFileList(listEl, state, files, (file) => {
    const samples = state.fileSamples.get(file);
    if (!samples) return; // still reading or failed
    active = file;
    rows.forEach((row, i) => row.setActive(files[i] === file));
    createPlayer(player, file, samples, noiseByFile.get(file) ?? []);
  });

  for (const [index, file] of files.entries()) {
    const row = rows[index]!;
    try {
      state.eventTarget.dispatchEvent(new AppFileStatusChangeEvent('Reading', file));
      row.setProgress(0.1);
      const knownSamples = state.fileSamples.get(file);
      const samples = knownSamples ?? await getSamples(file, (progress) => row.setProgress(progress * 0.45 + 0.1));
      state.fileSamples.set(file, samples);

      // Show the first readable file right away; the per-frame analysis below is
      // slower and runs after the video is on screen, filling in the overlay.
      if (!active) {
        active = file;
        row.setActive(true);
        await createPlayer(player, file, samples, []);
      }

      state.eventTarget.dispatchEvent(new AppFileStatusChangeEvent('Analyzing', file));

      const noise = await analyzeNoise(file, samples, (progress) => row.setProgress(progress * 0.45 + 0.55));
      noiseByFile.set(file, noise);
      state.eventTarget.dispatchEvent(new AppFileNoiseAddedEvent(noise, file));
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
