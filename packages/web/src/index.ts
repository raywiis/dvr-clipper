import { showVideo } from './showVideo';

const fileInput = document.getElementsByName('dropzone').item(0);
if (!fileInput) throw new Error('No file input named dropzone');
if (!(fileInput instanceof HTMLInputElement)) {
  throw new Error('Input is not for files');
}

const canvas = document.querySelector('canvas');
if (!canvas) throw new Error('No <canvas> element');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('No 2D canvas context');


const handleFiles = (files: FileList) => {
  for (let i = 0; i < files.length; i++) {
    const droppedFile = files[i];
    if (!droppedFile) {
      alert('no files found in dropped input');
      return;
    }

    // TODO: Analyze all the videos
    // TODO: Nice preview UI
    // TODO: Join multiple files into a single one if the goggles cut something
    showVideo(canvas, ctx, droppedFile);
    return;
  }
}

fileInput.addEventListener('drop', (dropEvent) => {
  if (!dropEvent.dataTransfer) {
    return;
  }
  handleFiles(dropEvent.dataTransfer.files);
})

fileInput.addEventListener('input', (inputEvent) => {
  console.log('input', inputEvent);
  if (fileInput.files) {
    handleFiles(fileInput.files)
    return;
  }
  if (inputEvent.dataTransfer) {
    handleFiles(inputEvent.dataTransfer.files);
    return;
  }
})

