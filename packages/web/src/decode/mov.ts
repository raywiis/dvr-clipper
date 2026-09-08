import * as mp4box from "mp4box";
import { type AllRegisteredBoxes } from "mp4box";
import { assert } from "../assert.ts";
import type { Sample } from "./mjpeg.ts";

async function* test(a: number) {
}
const ait = test(12);
ait.return()

function getMovSamplesIterator(file: File): AsyncIterator<Sample[], void, void> {
  const mp4boxFile = mp4box.createFile();
  const stream = file.stream();

  let sampleResolvers = Promise.withResolvers<Sample[]>()

  const timescaleResolvers = Promise.withResolvers<number>();

  mp4boxFile.onReady = (movie) => {
    if (!movie.hasMoov) {
      timescaleResolvers.reject(new Error('mov does not have a mov block'));
      return;
    }
    const moovBox = mp4boxFile.moov;
    const videoTrak = moovBox.traks.find((trak) => {
      return trak.mdia.hdlr.handler === "vide";
    });
    if (!videoTrak) {
      timescaleResolvers.reject(new Error('mov does not have a video trak'));
      return;
    }
    for(const videoTrack of movie.videoTracks) {
      mp4boxFile.setExtractionOptions(videoTrack.id, undefined, {nbSamples: 1000})
    }

    const timescale = videoTrak.mdia.mdhd.timescale;
    timescaleResolvers.resolve(timescale);
  }

  mp4boxFile.onSamples = (id, user, mp4BoxSamples) => {
    timescaleResolvers.promise.then(timescale => {
      const mySamples = mp4BoxSamples.map((s) => ({
        offset: s.offset,
        size: s.size,
        time: s.cts / timescale,
      }))
      sampleResolvers.resolve(mySamples);
      sampleResolvers = Promise.withResolvers();
    })
  }

  return {
    async next() {
      console.log('nexted')
      const samples = await sampleResolvers.promise;
      return {
        value: samples,
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
  const valueIterator = stream.values();
  let nextFilePos = 0;
  let moovBox: AllRegisteredBoxes["moov"] | undefined = undefined;
  mp4boxFile.onMoovStart = () => {
    console.log("moovstart");
  };
  mp4boxFile.onReady = (movie) => {
    console.log('ready', movie)

    for (const track of movie.tracks) {
      mp4boxFile.unsetExtractionOptions(track.id);
    }
    for (const videoTrack of movie.videoTracks) {
      mp4boxFile.setExtractionOptions(videoTrack.id, undefined, { nbSamples: 1000 });
    }
    console.log("mp4box ready");
  };
  mp4boxFile.onSamples = (...args) => {
    console.info('samples', args)
  }
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
    mp4boxFile.flush();
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
