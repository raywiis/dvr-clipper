import { assert } from "../assert.ts";
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

  const firstSection = sections.at(0);
  assert(firstSection, "No first section");
  const firstSample = firstSection.samples.at(0);
  assert(firstSample, "No first sample");

  const firstFrame = await decodeFrame(firstSection.file, firstSample);
  const { width, height } = firstFrame.bitmap;
  firstFrame.bitmap.close();

  const trackId = newFile.addTrack({
    type: "mjpg",
    timescale: TIMESCALE,
    width,
    height,
  });

  let dts = 0;

  for (const section of sections) {
    for (const [i, sample] of section.samples.entries()) {
      const frame = await getArrayBuffer(section.file, sample);
      const array = new Uint8Array(frame);

      const next = section.samples[i + 1];
      const durationSec = next ? next.time - sample.time : 1 / DEFAULT_FPS;
      const duration = Math.round(durationSec * TIMESCALE);

      newFile.addSample(trackId, array, {
        duration,
        dts,
        cts: dts,
        is_sync: true,
      });
      dts += duration;
    }
  }

  return newFile;
}
