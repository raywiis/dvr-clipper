import * as mp4box from "mp4box";
import { type AllRegisteredBoxes } from "mp4box";
import { assert } from "../assert.ts";
import type { Sample } from "./mjpeg.ts";

function getMovSamplesIterator(file: File): AsyncIterator<Sample[], void, void> {
  const mp4boxFile = mp4box.createFile();
  const stream = file.stream();

  let sampleResolvers = Promise.withResolvers<Sample[]>()

  const trackDataResolvers = Promise.withResolvers<{timescale: number, videoTrackId: number}>();

  mp4boxFile.onReady = (movie) => {
    if (!movie.hasMoov) {
      trackDataResolvers.reject(new Error('mov does not have a mov block'));
      return;
    }
    const videoTrack = movie.videoTracks.at(0);
    assert(videoTrack, "Invariant. No video track in movie");
    trackDataResolvers.resolve({
      timescale:
        videoTrack.timescale,
        videoTrackId: videoTrack.id
    });
  }

  mp4boxFile.onSamples = (id, user, mp4BoxSamples) => {
    trackDataResolvers.promise.then(td => {
      const mySamples = mp4BoxSamples.map((s) => ({
        offset: s.offset,
        size: s.size,
        time: s.cts / td.timescale,
      }))
      sampleResolvers.resolve(mySamples);
      const lastSample = mp4BoxSamples.at(-1)
      if (lastSample) {
        mp4boxFile.releaseUsedSamples(td.videoTrackId, lastSample.number + 1);
      }
    })
  }

  return {
    async next() {
      console.log('nexted')
      return {
        value: [],
        done: false,
      }
    },
    async return() {
      console.log('returned')
      return {
        value: undefined,
        done: true,
      }
    },
    async throw() {
      console.log('thrown')
      return {
        value: undefined,
        done: true,
      }
    }
  }
};

export async function getMovSamplesBulk(
  file: File,
  onProgress: (percent: number) => void,
): Promise<Sample[]> {
  const mp4boxFile = mp4box.createFile();
  const stream = file.stream();
  let totalOffset = 0;

  const DEFAULT_SLICE_SIZE = 1024 * 64;

  let ready = false
  mp4boxFile.onReady = (movie) => {
    ready = true;
    console.log('ready', movie, mp4boxFile);
  }

  const getChunk = async (offset: number) => {
    const end = Math.min(offset + DEFAULT_SLICE_SIZE, file.size);
    const blob = file.slice(offset, end);
    assert(blob.size > 0, `Empty read at offset ${offset}`);
    const buffer = await blob.arrayBuffer();
    const mp4boxBuffer = mp4box.MP4BoxBuffer.fromArrayBuffer(
      buffer,
      offset,
    );

    mp4boxBuffer.fileStart = offset;
    return mp4boxBuffer;
  }

  const initalBuffer = await getChunk(0);
  let nextOffset = mp4boxFile.appendBuffer(initalBuffer);
  while (true) {
    const buffer = await getChunk(nextOffset);
    nextOffset = mp4boxFile.appendBuffer(buffer);
    console.log({ nextOffset })
    // const videoTrak = mp4boxFile.moov.traks.find(t => t.mdia.hdlr.handler === 'vide');
    // if (videoTrak) {
    //   break;
    // }
    if (!nextOffset) {
      throw new Error('No next offset')
    }
    if (nextOffset >= file.size) {
      console.log({ nextOffset, s: file.size })
      break;
    }
    // assert(nextOffset, "No next offset")
  }
  mp4boxFile.flush();
  // for await (const chunk of stream) {
  //   const mp4boxBuffer = mp4box.MP4BoxBuffer.fromArrayBuffer(
  //     chunk.buffer,
  //     totalOffset,
  //   );
  //   totalOffset += chunk.byteLength;
  //   mp4boxFile.appendBuffer(mp4boxBuffer);
  //   onProgress(totalOffset / file.size);
  // }
  const moovBox = mp4boxFile.moov;
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
