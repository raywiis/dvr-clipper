import {
  AVMediaType,
  AVSeekFlag,
  WebDemuxer,
  type WebAVPacket,
} from "web-demuxer";
import webDemuxerWasmUrl from "web-demuxer/wasm?url";
import { assert } from "../assert.ts";
import type { Sample } from "./mjpeg.ts";

const SUPPORTED_CONTAINERS = new Set([
  "avi",
  "mov",
  "mp4",
  "m4a",
  "3gp",
  "3g2",
  "mj2",
]);

type DemuxReader = {
  demuxer: WebDemuxer;
  duration: number;
  videoStreamIndex: number;
};

const readers = new WeakMap<File, Promise<DemuxReader>>();
let wasmDataUrl: Promise<string> | undefined;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      assert(typeof reader.result === "string", "Could not read the demuxer");
      resolve(reader.result);
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Could not read the demuxer")),
    );
    reader.readAsDataURL(blob);
  });
}

function getWasmDataUrl(): Promise<string> {
  if (!wasmDataUrl) {
    wasmDataUrl = fetch(new URL(webDemuxerWasmUrl, location.href).href).then(
      async (response) => {
        assert(response.ok, "Could not load the video demuxer");
        return readAsDataUrl(await response.blob());
      },
    );
  }
  return wasmDataUrl;
}

async function createReader(file: File): Promise<DemuxReader> {
  const demuxer = new WebDemuxer({ wasmFilePath: await getWasmDataUrl() });

  try {
    await demuxer.load(file);
    const media = await demuxer.getMediaInfo();
    const containerNames = media.format_name.split(",");
    assert(
      containerNames.some((name) => SUPPORTED_CONTAINERS.has(name)),
      `Unsupported container: ${media.format_name || "unknown"}`,
    );

    const video = media.streams.find(
      (stream) => stream.codec_type === AVMediaType.AVMEDIA_TYPE_VIDEO,
    );
    assert(video, "Video file does not contain a video stream");
    assert(
      video.codec_name.toLowerCase() === "mjpeg",
      `Unsupported video codec: ${video.codec_name || "unknown"}. Only MJPEG is supported`,
    );

    return {
      demuxer,
      duration: video.duration || media.duration,
      videoStreamIndex: video.index,
    };
  } catch (error) {
    demuxer.destroy();
    throw error;
  }
}

function getReader(file: File): Promise<DemuxReader> {
  let reader = readers.get(file);
  if (!reader) {
    reader = createReader(file);
    readers.set(file, reader);
  }
  return reader;
}

function assertJpegPacket(packet: WebAVPacket, context: string): void {
  assert(
    packet.data[0] === 0xff && packet.data[1] === 0xd8,
    `${context} is not a JPEG frame`,
  );
}

export async function getDemuxedSamples(
  file: File,
  onProgress: (progress: number) => void,
): Promise<Sample[]> {
  const { demuxer, duration, videoStreamIndex } = await getReader(file);
  const packets = demuxer.readAVPacket(
    0,
    0,
    AVMediaType.AVMEDIA_TYPE_VIDEO,
    videoStreamIndex,
  );
  const samples: Sample[] = [];

  for await (const packet of packets) {
    if (samples.length === 0) assertJpegPacket(packet, "First video frame");
    samples.push({ offset: null, size: packet.size, time: packet.timestamp });

    if (duration > 0) {
      onProgress(
        Math.min(
          1,
          (packet.timestamp + Math.max(0, packet.duration)) / duration,
        ),
      );
    }
  }

  assert(samples.length > 0, "Video file does not contain any video frames");
  onProgress(1);
  return samples;
}

export async function getDemuxedSampleData(
  file: File,
  sample: Sample,
): Promise<ArrayBuffer> {
  const { demuxer, videoStreamIndex } = await getReader(file);
  const packet = await demuxer.getAVPacket(
    sample.time,
    AVMediaType.AVMEDIA_TYPE_VIDEO,
    videoStreamIndex,
    AVSeekFlag.AVSEEK_FLAG_BACKWARD,
  );

  assert(
    Math.abs(packet.timestamp - sample.time) < 1e-6,
    `Missing video frame at ${sample.time} seconds`,
  );
  assert(
    packet.size === sample.size,
    `Video frame size changed at ${sample.time} seconds`,
  );
  assertJpegPacket(packet, `Video frame at ${sample.time} seconds`);
  return packet.data.slice().buffer;
}
