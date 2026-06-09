import { getAviSamples } from "./decode/avi";
import { decodeFrame, type DecodedFrame, type Sample } from "./decode/mjpeg";

async function getSamples(file: File): Promise<Sample[]> {
  // Sniff the container from the first bytes instead of trusting the extension.
  const head = new DataView(await file.slice(0, 12).arrayBuffer());
  if (head.byteLength < 12) throw new Error('File too small to be a video');
  const tag = (offset: number) => String.fromCharCode(
    head.getUint8(offset), head.getUint8(offset + 1), head.getUint8(offset + 2), head.getUint8(offset + 3),
  );
  if (tag(0) === 'RIFF' && tag(8) === 'AVI ') return getAviSamples(file);
  if (['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].includes(tag(4))) {
    const {getMovSamples} = await import('./decode/mov');
    return getMovSamples(file);
  }
  throw new Error('Unrecognized container: expected an AVI or MOV/MP4 file');
}

export async function showVideo(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, file: File) {
  const samples = await getSamples(file);
  if (samples.length === 0) throw new Error('No frames decoded');

  const first = await decodeFrame(file, samples[0]!);
  canvas.width = first.bitmap.width;
  canvas.height = first.bitmap.height;
  ctx.drawImage(first.bitmap, 0, 0);
  first.bitmap.close();

  // Bounded prefetch queue so network/decoding runs ahead of display.
  const QUEUE_MAX = 24;
  const queue: DecodedFrame[] = [];
  let nextToDecode = 1;
  let decoding = false;

  async function topUp() {
    if (decoding) return;
    decoding = true;
    while (nextToDecode < samples.length && queue.length < QUEUE_MAX) {
      queue.push(await decodeFrame(file, samples[nextToDecode++]!));
    }
    decoding = false;
  }

  let startClock: number | undefined;
  function render(now: number) {
    if (startClock === undefined) startClock = now;
    const elapsed = (now - startClock) / 1000;

    // Advance to the latest frame whose timestamp has arrived.
    let current: DecodedFrame | null = null;
    while (queue.length && queue[0]!.time <= elapsed) {
      if (current) current.bitmap.close();
      current = queue.shift()!;
    }
    if (current) {
      ctx!.drawImage(current.bitmap, 0, 0, canvas!.width, canvas!.height);
      current.bitmap.close();
    }

    topUp();
    if (queue.length || nextToDecode < samples.length) {
      requestAnimationFrame(render);
    } else {
      console.log('playback finished');
    }
  }

  topUp();
  requestAnimationFrame(render);
}
