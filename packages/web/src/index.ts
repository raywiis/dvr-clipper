import { assert } from './assert';
import { select } from './dom';
import { showVideo } from './showVideo';

const fileInput = select('.dropzone input[type="file"]', HTMLInputElement);
const errorLabel = select('#dropzone-error', HTMLElement);
const canvas = select('canvas', HTMLCanvasElement);
const scrub = select('.timeline-scrub', HTMLInputElement);
const timeLabel = select('.timeline-time', HTMLElement);

async function handleFiles(files: FileList) {
  const file = files[0];
  if (!file) {
    errorLabel.textContent = 'No files found in dropped input';
    return;
  }

  errorLabel.textContent = '';
  try {
    // TODO: Analyze all the videos
    // TODO: Nice preview UI
    // TODO: Join multiple files into a single one if the goggles cut something
    const ctx = canvas.getContext('2d');
    assert(ctx, "No canvas context");
    await showVideo({ canvas, ctx, scrub, timeLabel }, file);
  } catch (err) {
    errorLabel.textContent = err instanceof Error ? err.message : String(err);
  }
}

// The input covers the dropzone, so the browser handles click and drop natively.
fileInput.addEventListener('input', () => {
  if (fileInput.files) {
    handleFiles(fileInput.files);
  }
});
