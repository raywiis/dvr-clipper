import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } from "mediabunny";
import { assert } from "../assert.ts";
import type { Sample } from "./mjpeg.ts";

const SUPPORTED_MJPEG_CODECS = new Set(["jpeg", "mjpg", "mjpa", "mjpb"]);
type MovReader = {
  duration: number;
  sink: EncodedPacketSink;
};

const readers = new WeakMap<File, Promise<MovReader>>();

async function createMovReader(file: File): Promise<MovReader> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file, {
      maxCacheSize: 8 * 1024 * 1024,
      useStreamReader: true,
    }),
  });

  const track = await input.getPrimaryVideoTrack();
  assert(track, "MOV does not contain a video track");

  const codec = await track.getInternalCodecId();
  assert(
    typeof codec === "string" &&
      SUPPORTED_MJPEG_CODECS.has(codec.toLowerCase()),
    `Unsupported MOV video codec: ${String(codec)}`,
  );

  const metadataDuration = await track.getDurationFromMetadata();
  const duration =
    metadataDuration ?? (await track.computeDuration({ skipLiveWait: true }));
  const sink = new EncodedPacketSink(track);

  return {
    duration,
    sink,
  };
}

function getMovReader(file: File): Promise<MovReader> {
  let reader = readers.get(file);
  if (!reader) {
    reader = createMovReader(file);
    readers.set(file, reader);
  }
  return reader;
}

export async function* streamMovSamples(file: File) {
  const { duration, sink } = await getMovReader(file);
  for await (const packet of sink.packets(undefined, undefined, {
    metadataOnly: true,
  })) {
    const sample = {
      offset: null,
      size: packet.byteLength,
      time: packet.timestamp,
    };
    yield { sample, progress: 1 };
  }
}

export async function getMovSampleData(
  file: File,
  sample: Sample,
): Promise<ArrayBuffer> {
  const { sink } = await getMovReader(file);
  const packet = await sink.getPacket(sample.time);
  assert(packet, `Missing MOV frame at ${sample.time} seconds`);
  assert(
    packet.byteLength === sample.size,
    `MOV frame size changed at ${sample.time} seconds`,
  );

  return packet.data.slice().buffer;
}
