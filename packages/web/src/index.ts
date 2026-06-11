import { showVideo } from './showVideo';

const fileInput = document.querySelector('.dropzone input[type="file"]');
if (!(fileInput instanceof HTMLInputElement)) {
  throw new Error('No file input inside dropzone');
}

const errorLabel = document.getElementById('dropzone-error');
if (!errorLabel) throw new Error('No dropzone error element');

const canvas = document.querySelector('canvas');
if (!canvas) throw new Error('No <canvas> element');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('No 2D canvas context');

async function handleFiles(files: FileList) {
  const file = files[0];
  if (!file) {
    errorLabel!.textContent = 'No files found in dropped input';
    return;
  }

  errorLabel!.textContent = '';
  try {
    // TODO: Analyze all the videos
    // TODO: Nice preview UI
    // TODO: Join multiple files into a single one if the goggles cut something
    await showVideo(canvas!, ctx!, file);
  } catch (err) {
    errorLabel!.textContent = err instanceof Error ? err.message : String(err);
  }
}

// The input covers the dropzone, so the browser handles click and drop natively.
fileInput.addEventListener('input', () => {
  if (fileInput.files) {
    handleFiles(fileInput.files);
  }
});
