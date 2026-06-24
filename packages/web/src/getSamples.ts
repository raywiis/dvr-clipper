import { assert } from "./assert";
import { getAviSamples } from "./decode/avi";
import { type Sample } from "./decode/mjpeg";

export async function getSamples(file: File, onProgress: (progress: number) => void): Promise<Sample[]> {
  const head = new DataView(await file.slice(0, 12).arrayBuffer());
  assert(head.byteLength >= 12, 'File too small to be a video');

  const tag = (offset: number) => String.fromCharCode(
    head.getUint8(offset), head.getUint8(offset + 1), head.getUint8(offset + 2), head.getUint8(offset + 3),
  );

  if (tag(0) === 'RIFF' && tag(8) === 'AVI ') {
    const samples = await getAviSamples(file);
    return samples;
  } else {
    assert(
      ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].includes(tag(4)),
      'Unrecognized container: expected an AVI or MOV/MP4 file',
    );
    const { getMovSamples } = await import('./decode/mov');
    const samples = await getMovSamples(file, onProgress);
    return samples
  }
}
