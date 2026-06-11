import { assert } from './assert';
import { select } from './dom';
import { type Sample } from './decode/mjpeg';
import { createPlayer, formatTime } from './player';
import { renderFileList } from './fileList';
import { getSamples } from './showVideo';

const fileInput = select('.dropzone input[type="file"]', HTMLInputElement);
const errorLabel = select('#dropzone-error', HTMLElement);
const canvas = select('canvas', HTMLCanvasElement);
const scrub = select('.timeline-scrub', HTMLInputElement);
const timeLabel = select('.timeline-time', HTMLElement);
const listEl = select('.filelist', HTMLUListElement);

const ctx = canvas.getContext('2d');
assert(ctx, 'No canvas context');
const player = { canvas, ctx, scrub, timeLabel };

async function handleFiles(fileList: FileList) {
  const files = [...fileList];
  if (files.length === 0) {
    errorLabel.textContent = 'No files found in dropped input';
    return;
  }
  errorLabel.textContent = '';

  const decoded = new Map<File, Sample[]>();
  let active: File | null = null;

  const rows = renderFileList(listEl, files, (file) => {
    const samples = decoded.get(file);
    if (!samples) return; // still reading or failed
    active = file;
    rows.forEach((row, i) => row.setActive(files[i] === file));
    createPlayer(player, file, samples);
  });

  for (const [index, file] of files.entries()) {
    const row = rows[index]!;
    try {
      row.setStatus('Reading…');
      row.setProgress(0.15);
      const samples = await getSamples(file, (progress) => row.setProgress(progress * .85 + 0.15));
      decoded.set(file, samples);
      const duration = samples[samples.length - 1]?.time ?? 0;
      row.setReady(`${formatTime(duration)} · ${samples.length} frames`);
      if (!active) {
        active = file;
        row.setActive(true);
        await createPlayer(player, file, samples);
      }
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
