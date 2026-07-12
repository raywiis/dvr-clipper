import { getArrayBuffer, decodeFrame, type Sample } from "../decode/mjpeg.ts";
import * as mp4box from 'mp4box';

export type Section = {
  file: File;
  samples: Sample[];
}

const TIMESCALE = 90000;
const DEFAULT_FPS = 30;

export async function encodeMov(sections: Section[]) {
  const newFile = mp4box.createFile();

  // Loaded lazily from the first frame; frames are streamed one at a time so
  // we never hold more than a single frame's bytes at once.
  let trackId: number | undefined;
  let dts = 0;

  for (const section of sections) {
    for (const [i, sample] of section.samples.entries()) {
      const frame = await getArrayBuffer(section.file, sample);
      const array = new Uint8Array(frame);

      if (trackId === undefined) {
        // Derive the real frame dimensions by decoding the first frame.
        const { bitmap } = await decodeFrame(section.file, sample);
        const { width, height } = bitmap;
        bitmap.close();
        trackId = newFile.addTrack({
          type: "mjpg",
          timescale: TIMESCALE,
          width,
          height,
        });
      }

      // Duration is the delta to the next frame in this section, in ticks.
      // Deltas stay within a section so cuts between clips don't produce
      // negative or oversized gaps.
      const next = section.samples[i + 1];
      const durationSec = next ? next.time - sample.time : 1 / DEFAULT_FPS;
      const duration = Math.round(durationSec * TIMESCALE);

      newFile.addSample(trackId, array, {
        duration,
        dts,
        cts: dts,
        is_sync: true, // Every MJPEG frame is a keyframe.
      });
      dts += duration;
    }
  }

  return newFile;
}
