import * as mp4box from "mp4box";
import { type AllRegisteredBoxes } from "mp4box";
import { assert } from "../assert.ts";
import type { Sample } from "./mjpeg.ts";

export async function getMovSamples(
  file: File,
  onProgress: (percent: number) => void,
): Promise<Sample[]> {
  const mp4boxFile = mp4box.createFile();
  const stream = file.stream();
  const valueIterator = stream.values();
  let nextFilePos = 0;
  let moovBox: AllRegisteredBoxes["moov"] | undefined = undefined;
  mp4boxFile.onMoovStart = () => {
    console.log("moovstart");
  };
  mp4boxFile.onReady = () => {
    console.log("mp4box ready");
  };
  let totalOffset = 0;
  mp4boxFile.start();
  while (true) {
    const iterationResult = await valueIterator.next();
    onProgress(totalOffset / file.size);
    if (iterationResult.done) {
      mp4boxFile.flush();
      moovBox = mp4boxFile.moov;
      break;
    }
    const chunkBuffer = iterationResult.value.buffer;

    const mp4boxBuffer = mp4box.MP4BoxBuffer.fromArrayBuffer(
      chunkBuffer,
      totalOffset,
    );
    totalOffset += chunkBuffer.byteLength;
    nextFilePos = mp4boxFile.appendBuffer(mp4boxBuffer);
    assert(nextFilePos !== undefined, "mp4box not ready to parse");
  }

  assert(moovBox, "no moovbox");

  const videoTrak = moovBox.traks.find((trak) => {
    return trak.mdia.hdlr.handler === "vide";
  });
  assert(videoTrak, "No video track found");
  const timescale = videoTrak.mdia.mdhd.timescale;

  const newSamples: Sample[] = videoTrak.samples.map((sample) => {
    return {
      offset: sample.offset,
      size: sample.size,
      time: sample.cts / timescale,
    };
  });

  return newSamples;
}
