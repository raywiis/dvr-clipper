import { assert } from "../assert.ts";
import { getArrayBuffer, decodeFrame, type Sample } from "../decode/mjpeg.ts";
import * as mp4box from "mp4box";

import {Output, MovOutputFormat, StreamTarget, EncodedVideoPacketSource, VideoSampleSource, VideoSample, CanvasSource, CustomSource, QUALITY_HIGH, Quality } from 'mediabunny'

export type Section = {
  file: File;
  samples: Sample[];
};

const TIMESCALE = 90000;
const DEFAULT_FPS = 30;

export async function encodeMovMediabunny(sections: Section[], fileName: string) {
  const dir = await window.navigator.storage.getDirectory();
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const outputStream = await fileHandle.createWritable();
  const target = new StreamTarget(outputStream);
  const format = new MovOutputFormat()
  const output = new Output({ format, target });

  assert(sections.length > 0, "sections 0 length");
  const firstSection = sections.at(0)!;
  const firstSampleData = await decodeFrame(firstSection.file, firstSection.samples.at(0)!);

  // TODO: Double check that all vidya has the correct width/height
  const canvas = new OffscreenCanvas(firstSampleData.bitmap.width, firstSampleData.bitmap.height);
  const videoSource = new CanvasSource(canvas, { codec: 'vp9', quality: new Quality('very-low') })

  const track = output.addVideoTrack(videoSource)

  const ctx = canvas.getContext('2d');

  assert(ctx, "no canvas");
  output.start();
  let timestamp = 0;
  let sampleCount = 0;
  for (const section of sections) {
    for (const sample of section.samples) {
      sampleCount += 1;
      console.log({sampleCount})
      if (sampleCount % 100 === 0) {
        console.info(sampleCount);
      }
      const sampleData = await decodeFrame(section.file, sample);
      ctx.drawImage(sampleData.bitmap, 0, 0);
      await videoSource.add(timestamp);
      timestamp += sampleData.time;
    }
  }
  videoSource.close();

  const file = await fileHandle.getFile()
  const url = URL.createObjectURL(file);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
}

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
