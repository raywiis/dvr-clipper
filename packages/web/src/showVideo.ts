import { decodeFrame, type DecodedFrame } from "./decode/mjpeg";
import { getMovSamples } from "./decode/mov";

export async function showVideo(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, file: File) {
  const samples = await getMovSamples(file);
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
