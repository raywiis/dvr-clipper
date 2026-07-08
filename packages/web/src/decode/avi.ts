import { assert } from "../assert.ts";
import type { Sample } from "./mjpeg.ts";

// Minimal RIFF/AVI demuxer for MJPEG DVR files. Reads only chunk headers, the
// 'hdrl' header list and the 'idx1' index — never the frame data itself.
//
// AVI layout (sizes little-endian; odd-sized chunks get a pad byte):
//
//   RIFF('AVI '
//     LIST('hdrl'                     file + stream metadata
//       'avih'                        frame timing fallback
//       LIST('strl' 'strh' 'strf')    one per stream: codec, fps, frame count
//     )
//     LIST('movi' '00dc' '01wb' ...)  frame data: '<stream##><dc|db>' chunks
//     'idx1'                          index: one entry per movi chunk
//   )

const MJPEG_FOURCCS = new Set(["MJPG", "mjpg", "dmb1", "AVI1"]);

async function readBytes(
  file: File,
  offset: number,
  length: number,
): Promise<DataView> {
  const buf = await file.slice(offset, offset + length).arrayBuffer();
  assert(
    buf.byteLength >= length,
    `AVI: unexpected end of file reading ${length} bytes at offset ${offset}`,
  );
  return new DataView(buf);
}

function fourcc(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/** Fourcc with trailing nulls/spaces stripped, for codec comparisons. */
function cleanFourcc(view: DataView, offset: number): string {
  return fourcc(view, offset).replace(/[\0 ]+$/, "");
}

/** Bytes a chunk occupies in its parent: 8-byte header + data + pad byte. */
function chunkSpan(dataSize: number): number {
  return 8 + dataSize + (dataSize & 1);
}

type ChunkHeader = { id: string; size: number; listType?: string };

/** Reads one chunk header from the file; for LIST chunks also the list type. */
async function readChunkHeader(
  file: File,
  pos: number,
  end: number,
): Promise<ChunkHeader> {
  const view = await readBytes(file, pos, Math.min(12, end - pos));
  const id = fourcc(view, 0);
  const size = view.getUint32(4, true);
  if (id === "LIST" && view.byteLength >= 12)
    return { id, size, listType: fourcc(view, 8) };
  return { id, size };
}

type VideoStream = {
  /** Two-digit stream number used in movi chunk ids, e.g. '00' for '00dc' */
  chunkPrefix: string;
  /** Seconds per frame */
  frameDuration: number;
  /** Frame count declared in the stream header */
  frameCount: number;
};

type StreamInfo = {
  type: string;
  codec: string;
  scale: number;
  rate: number;
  length: number;
};

/** Parses one LIST('strl') — the per-stream 'strh' header plus 'strf' format. */
function parseStrl(hdrl: DataView, start: number, end: number): StreamInfo {
  end = Math.min(end, hdrl.byteLength);
  assert(
    start + 44 <= end && fourcc(hdrl, start) === "strh",
    "AVI: malformed strl list (missing strh)",
  );
  const strhSize = hdrl.getUint32(start + 4, true);
  const strh = start + 8;
  const info: StreamInfo = {
    type: fourcc(hdrl, strh), // fccType: 'vids', 'auds', ...
    codec: cleanFourcc(hdrl, strh + 4), // fccHandler
    scale: hdrl.getUint32(strh + 20, true), // dwScale
    rate: hdrl.getUint32(strh + 24, true), // dwRate
    length: hdrl.getUint32(strh + 32, true), // dwLength, in frames for video
  };

  // 'strf' (BITMAPINFOHEADER) follows strh; its biCompression field is more
  // reliable than fccHandler, which many muxers leave blank.
  const strf = strh + strhSize + (strhSize & 1);
  if (strf + 28 <= end && fourcc(hdrl, strf) === "strf") {
    const compression = cleanFourcc(hdrl, strf + 8 + 16); // biCompression
    if (compression) info.codec = compression;
  }
  return info;
}

/** Finds the video stream in the LIST('hdrl') and validates it is MJPEG. */
function parseHdrl(hdrl: DataView): VideoStream {
  let microSecPerFrame = 0;
  let video: { index: number; info: StreamInfo } | undefined;
  let streamCount = 0;

  let pos = 0;
  while (pos + 8 <= hdrl.byteLength) {
    const id = fourcc(hdrl, pos);
    const size = hdrl.getUint32(pos + 4, true);
    if (id === "avih") {
      microSecPerFrame = hdrl.getUint32(pos + 8, true); // dwMicroSecPerFrame
    } else if (
      id === "LIST" &&
      pos + 12 <= hdrl.byteLength &&
      fourcc(hdrl, pos + 8) === "strl"
    ) {
      const info = parseStrl(hdrl, pos + 12, pos + 8 + size);
      if (info.type === "vids") {
        assert(!video, "AVI: multiple video streams found");
        video = { index: streamCount, info };
      }
      streamCount++;
    }
    pos += chunkSpan(size);
  }

  assert(video, "AVI: no video stream found");
  const { codec, scale, rate, length } = video.info;
  assert(
    MJPEG_FOURCCS.has(codec),
    `AVI: unsupported video codec '${codec || "unknown"}', only MJPEG is supported`,
  );
  const frameDuration =
    rate > 0 && scale > 0 ? scale / rate : microSecPerFrame / 1e6;
  assert(frameDuration > 0, "AVI: invalid frame rate in stream header");

  return {
    chunkPrefix: String(video.index).padStart(2, "0"),
    frameDuration,
    frameCount: length,
  };
}

function isVideoChunk(id: string, prefix: string): boolean {
  return id.startsWith(prefix) && (id.endsWith("dc") || id.endsWith("db"));
}

/** idx1 offsets are usually relative to the 'movi' fourcc, but some muxers
 *  write absolute file offsets. Probe both against the actual chunk id. */
async function resolveIndexBase(
  file: File,
  moviStart: number,
  entryId: string,
  entryOffset: number,
): Promise<number> {
  for (const base of [moviStart, 0]) {
    const at = base + entryOffset;
    if (at + 4 > file.size) continue;
    if (fourcc(await readBytes(file, at, 4), 0) === entryId) return base;
  }
  throw new Error("AVI: idx1 index offsets do not point at chunk headers");
}

/** Builds samples from the idx1 index: 16-byte entries of id/flags/offset/size. */
async function samplesFromIndex(
  file: File,
  idx1: DataView,
  moviStart: number,
  video: VideoStream,
): Promise<Sample[]> {
  const samples: Sample[] = [];
  let base: number | undefined;
  let frame = 0;
  for (let pos = 0; pos + 16 <= idx1.byteLength; pos += 16) {
    const id = fourcc(idx1, pos);
    if (!isVideoChunk(id, video.chunkPrefix)) continue;
    const offset = idx1.getUint32(pos + 8, true);
    const size = idx1.getUint32(pos + 12, true);
    const time = frame++ * video.frameDuration;
    if (size === 0) continue; // dropped/duplicate frame placeholder
    if (base === undefined)
      base = await resolveIndexBase(file, moviStart, id, offset);
    const dataOffset = base + offset + 8; // skip the chunk's own header
    if (dataOffset + size > file.size) {
      console.warn(
        `AVI: index entry at frame ${frame - 1} points past end of file, stopping`,
      );
      break;
    }
    samples.push({ offset: dataOffset, size, time });
  }
  return samples;
}

/** Fallback for files without an idx1 index: walk the movi list chunk by chunk. */
async function samplesFromMoviScan(
  file: File,
  movi: { start: number; end: number },
  video: VideoStream,
): Promise<Sample[]> {
  const samples: Sample[] = [];
  let frame = 0;
  let pos = movi.start + 4; // skip the 'movi' fourcc itself
  while (pos + 8 <= movi.end) {
    const { id, size, listType } = await readChunkHeader(file, pos, movi.end);
    if (listType) {
      pos += 12; // descend into 'rec ' grouping lists
      continue;
    }
    if (isVideoChunk(id, video.chunkPrefix)) {
      if (size > 0)
        samples.push({
          offset: pos + 8,
          size,
          time: frame * video.frameDuration,
        });
      frame++;
    }
    pos += chunkSpan(size);
  }
  return samples;
}

export async function getAviSamples(file: File): Promise<Sample[]> {
  const riff = await readBytes(file, 0, 12);
  assert(
    fourcc(riff, 0) === "RIFF" && fourcc(riff, 8) === "AVI ",
    "AVI: missing RIFF/AVI signature",
  );
  const riffSize = riff.getUint32(4, true);
  if (8 + riffSize > file.size) {
    console.warn("AVI: RIFF size exceeds file size, file looks truncated");
  }
  if (file.size > 8 + riffSize + 24) {
    console.warn(
      "AVI: extra data after first RIFF segment (OpenDML AVIX?), only the first segment will play",
    );
  }

  // Walk the top-level chunks to locate the header list, movi list and index.
  const riffEnd = Math.min(8 + riffSize, file.size);
  let video: VideoStream | undefined;
  let movi: { start: number; end: number } | undefined;
  let idx1: DataView | undefined;

  let pos = 12;
  while (pos + 8 <= riffEnd) {
    const chunk = await readChunkHeader(file, pos, riffEnd);
    if (chunk.listType === "hdrl") {
      video = parseHdrl(await readBytes(file, pos + 12, chunk.size - 4));
    } else if (chunk.listType === "movi") {
      movi = { start: pos + 8, end: Math.min(pos + 8 + chunk.size, file.size) };
    } else if (chunk.id === "idx1") {
      idx1 = await readBytes(file, pos + 8, chunk.size);
    }
    pos += chunkSpan(chunk.size);
  }

  assert(video, "AVI: no hdrl header list found");
  assert(movi, "AVI: no movi list found");

  const samples = idx1
    ? await samplesFromIndex(file, idx1, movi.start, video)
    : await samplesFromMoviScan(file, movi, video);

  assert(samples.length > 0, "AVI: no video frames found");
  if (
    video.frameCount &&
    Math.abs(samples.length - video.frameCount) > video.frameCount * 0.05
  ) {
    console.warn(
      `AVI: header declares ${video.frameCount} frames but found ${samples.length}`,
    );
  }

  // Frames must be JPEGs for the shared MJPEG decode path.
  const soi = await readBytes(file, samples[0]!.offset, 2);
  assert(
    soi.getUint16(0) === 0xffd8,
    "AVI: first frame is not a JPEG (missing SOI marker)",
  );

  return samples;
}
