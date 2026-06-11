import { assert } from "./assert";
import { getAviSamples } from "./decode/avi";
import { type Sample } from "./decode/mjpeg";
import { createPlayer, type PlayerElements } from "./player";

async function getSamples(file: File): Promise<Sample[]> {
  // Sniff the container from the first bytes instead of trusting the extension.
  const head = new DataView(await file.slice(0, 12).arrayBuffer());
  assert(head.byteLength >= 12, 'File too small to be a video');
  const tag = (offset: number) => String.fromCharCode(
    head.getUint8(offset), head.getUint8(offset + 1), head.getUint8(offset + 2), head.getUint8(offset + 3),
  );
  if (tag(0) === 'RIFF' && tag(8) === 'AVI ') return getAviSamples(file);
  assert(
    ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].includes(tag(4)),
    'Unrecognized container: expected an AVI or MOV/MP4 file',
  );
  const { getMovSamples } = await import('./decode/mov');
  return getMovSamples(file);
}

export async function showVideo(els: PlayerElements, file: File) {
  const samples = await getSamples(file);
  assert(samples.length > 0, 'No frames decoded');
  await createPlayer(els, file, samples);
}
