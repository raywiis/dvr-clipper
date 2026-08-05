import * as mp4box from "mp4box";
import type { Box } from "mp4box";
import { assert } from "./assert.ts";
import type { Sample } from "./decode/mjpeg.ts";

export type VideoTrackInfo = {
  /** Codec string (e.g. "avc1", "mjpeg", "hvc1") */
  codec: string;
  /** Track width in pixels (0 if unknown) */
  width: number;
  /** Track height in pixels (0 if unknown) */
  height: number;
  /** Bitrate in bits per second */
  bitrate: number;
  /** Number of samples / frames */
  sampleCount: number;
  /** Track duration in seconds */
  duration: number;
  /** Track timescale (ticks per second) */
  timescale: number;
  /** Language code (e.g. "en", "und") */
  language: string;
  /** Average frame rate (fps), 0 if unknown */
  frameRate: number;
};

export type AudioTrackInfo = {
  /** Codec string */
  codec: string;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of channels */
  channelCount: number;
  /** Bitrate in bits per second */
  bitrate: number;
  /** Track duration in seconds */
  duration: number;
  /** Language code */
  language: string;
};

/**
 * Common metadata tags stored in the udta box of MOV/MP4 files.
 * Keys are 4-character QuickTime/Apple codes.
 */
export type MetadataTags = {
  /** Title */
  title?: string;
  /** Camera make / manufacturer (e.g. "GoPro", "DJI") */
  make?: string;
  /** Camera model (e.g. "Hero10 Black", "Avata 2") */
  model?: string;
  /** Encoder / library used (e.g. "Lavf60.16.100") */
  encoder?: string;
  /** Software used to create the file */
  software?: string;
  /** Creation date (e.g. "2024-01-15T10:30:00Z") */
  creationDate?: string;
  /** Copyright notice */
  copyright?: string;
  /** Description / comment */
  description?: string;
  /** All raw tags found in the file */
  raw: Record<string, string>;
};

export type VideoMetadata = {
  /** File name */
  name: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type (from the File object) */
  mimeType: string;
  /** File last modified timestamp */
  lastModified: Date;
  /** Container format */
  container: "MOV/MP4" | "AVI" | "unknown";
  /** Total duration in seconds */
  duration: number;
  /** Compatible brands (MP4 boxes) */
  brands: string[];
  /** Whether the file is fragmented (fMP4) */
  isFragmented: boolean;
  /** Whether the file is streamable (moov before mdat) */
  isProgressive: boolean;
  /** Video tracks */
  videoTracks: VideoTrackInfo[];
  /** Audio tracks */
  audioTracks: AudioTrackInfo[];
  /** Metadata tags from the udta box (camera make/model, encoder, etc.) */
  tags: MetadataTags;
};

/**
 * Extracts metadata from a video file. Handles both MOV/MP4 (via mp4box) and
 * AVI files. Returns a structured metadata object.
 */
export async function getVideoMetadata(
  file: File,
  samples: Sample[],
): Promise<VideoMetadata> {
  const head = new DataView(await file.slice(0, 12).arrayBuffer());
  assert(head.byteLength >= 12, "File too small to be a video");

  const tag = (offset: number) =>
    String.fromCharCode(
      head.getUint8(offset),
      head.getUint8(offset + 1),
      head.getUint8(offset + 2),
      head.getUint8(offset + 3),
    );

  const isAvi = tag(0) === "RIFF" && tag(8) === "AVI ";

  if (isAvi) {
    return getAviMetadata(file, samples);
  }

  return getMp4Metadata(file, samples);
}

/**
 * Extracts metadata from a MOV/MP4 file using mp4box.
 */
async function getMp4Metadata(
  file: File,
  samples: Sample[],
): Promise<VideoMetadata> {
  const mp4boxFile = mp4box.createFile();
  const stream = file.stream();
  const valueIterator = stream.values();
  let totalOffset = 0;

  // Wait for mp4box to fully parse the moov box
  const info = await new Promise<ReturnType<typeof mp4boxFile.getInfo>>(
    (resolve, reject) => {
      mp4boxFile.onReady = () => {
        try {
          resolve(mp4boxFile.getInfo());
        } catch (err) {
          reject(err);
        }
      };
      mp4boxFile.onError = (msg: string) => reject(new Error(msg));

      mp4boxFile.start();
      // Feed all data
      void (async () => {
        try {
          while (true) {
            const iterationResult = await valueIterator.next();
            if (iterationResult.done) {
              mp4boxFile.flush();
              break;
            }
            const chunkBuffer = iterationResult.value.buffer;
            const mp4boxBuffer = mp4box.MP4BoxBuffer.fromArrayBuffer(
              chunkBuffer,
              totalOffset,
            );
            totalOffset += chunkBuffer.byteLength;
            mp4boxFile.appendBuffer(mp4boxBuffer);
          }
        } catch (err) {
          reject(err);
        }
      })();
    },
  );

  const videoTracks: VideoTrackInfo[] = info.videoTracks.map((track) => {
    const fps =
      track.nb_samples > 0 && track.duration > 0
        ? track.nb_samples / (track.duration / track.timescale)
        : 0;
    return {
      codec: track.codec,
      width: track.video?.width ?? 0,
      height: track.video?.height ?? 0,
      bitrate: track.bitrate,
      sampleCount: track.nb_samples,
      duration: track.duration / track.timescale,
      timescale: track.timescale,
      language: track.language,
      frameRate: Math.round(fps * 100) / 100,
    };
  });

  const audioTracks: AudioTrackInfo[] = info.audioTracks.map((track) => ({
    codec: track.codec,
    sampleRate: track.audio?.sample_rate ?? 0,
    channelCount: track.audio?.channel_count ?? 0,
    bitrate: track.bitrate,
    duration: track.duration / track.timescale,
    language: track.language,
  }));

  // Fallback duration from samples if mp4box duration is 0
  const duration =
    info.duration > 0
      ? info.duration / info.timescale
      : samples.length > 0
        ? samples[samples.length - 1]!.time
        : 0;

  const tags = extractMetadataTags(mp4boxFile.moov);

  return {
    name: file.name,
    fileSize: file.size,
    mimeType: file.type,
    lastModified: new Date(file.lastModified),
    container: "MOV/MP4",
    duration,
    brands: info.brands,
    isFragmented: info.isFragmented,
    isProgressive: info.isProgressive,
    videoTracks,
    audioTracks,
    tags,
  };
}

/**
 * Extracts metadata from an AVI file. Relies on the already-parsed samples
 * for frame count and duration, since the AVI demuxer is minimal.
 */
async function getAviMetadata(
  file: File,
  samples: Sample[],
): Promise<VideoMetadata> {
  const duration =
    samples.length > 0
      ? samples[samples.length - 1]!.time
      : 0;

  // Calculate frame rate from sample timestamps
  let frameRate = 0;
  if (samples.length >= 2) {
    const firstTime = samples[0]!.time;
    const lastTime = samples[samples.length - 1]!.time;
    const elapsed = lastTime - firstTime;
    if (elapsed > 0) {
      frameRate = Math.round((samples.length / elapsed) * 100) / 100;
    }
  }

  // Try to read the BITMAPINFOHEADER for resolution from the AVI header
  let width = 0;
  let height = 0;
  try {
    const riff = new DataView(await file.slice(0, 12).arrayBuffer());
    const riffSize = riff.getUint32(4, true);
    const riffEnd = Math.min(8 + riffSize, file.size);

    // Walk top-level chunks looking for the hdrl list
    let pos = 12;
    while (pos + 8 <= riffEnd) {
      const chunkId = String.fromCharCode(
        riff.getUint8(pos),
        riff.getUint8(pos + 1),
        riff.getUint8(pos + 2),
        riff.getUint8(pos + 3),
      );
      const chunkSize = riff.getUint32(pos + 4, true);

      if (chunkId === "LIST") {
        const listType = String.fromCharCode(
          riff.getUint8(pos + 8),
          riff.getUint8(pos + 9),
          riff.getUint8(pos + 10),
          riff.getUint8(pos + 11),
        );
        if (listType === "hdrl") {
          // Found header list, look for strh/strf
          const hdrlData = new DataView(
            await file.slice(pos + 12, pos + 12 + chunkSize - 4).arrayBuffer(),
          );
          let hdrlPos = 0;
          while (hdrlPos + 8 <= hdrlData.byteLength) {
            const hdrlChunkId = String.fromCharCode(
              hdrlData.getUint8(hdrlPos),
              hdrlData.getUint8(hdrlPos + 1),
              hdrlData.getUint8(hdrlPos + 2),
              hdrlData.getUint8(hdrlPos + 3),
            );
            const hdrlChunkSize = hdrlData.getUint32(hdrlPos + 4, true);

            if (hdrlChunkId === "LIST") {
              const strlType = String.fromCharCode(
                hdrlData.getUint8(hdrlPos + 8),
                hdrlData.getUint8(hdrlPos + 9),
                hdrlData.getUint8(hdrlPos + 10),
                hdrlData.getUint8(hdrlPos + 11),
              );
              if (strlType === "strl") {
                // Found a stream list, look for strf
                const strlEnd = hdrlPos + 8 + hdrlChunkSize;
                let strlPos = hdrlPos + 12;
                while (strlPos + 8 <= strlEnd) {
                  const strlChunkId = String.fromCharCode(
                    hdrlData.getUint8(strlPos),
                    hdrlData.getUint8(strlPos + 1),
                    hdrlData.getUint8(strlPos + 2),
                    hdrlData.getUint8(strlPos + 3),
                  );
                  const strlChunkSize = hdrlData.getUint32(
                    strlPos + 4,
                    true,
                  );
                  if (strlChunkId === "strf" && strlChunkSize >= 40) {
                    // BITMAPINFOHEADER
                    width = hdrlData.getUint32(strlPos + 8 + 4, true);
                    height = hdrlData.getUint32(strlPos + 8 + 8, true);
                    // Some AVI files store height as negative to indicate
                    // top-down orientation
                    if (height < 0) height = -height;
                  }
                  strlPos +=
                    8 + strlChunkSize + (strlChunkSize & 1);
                }
              }
            }
            hdrlPos += 8 + hdrlChunkSize + (hdrlChunkSize & 1);
          }
          break;
        }
      }
      pos += 8 + chunkSize + (chunkSize & 1);
    }
  } catch {
    // Resolution parsing is best-effort
  }

  return {
    name: file.name,
    fileSize: file.size,
    mimeType: file.type,
    lastModified: new Date(file.lastModified),
    container: "AVI",
    duration,
    brands: [],
    isFragmented: false,
    isProgressive: true,
    videoTracks: [
      {
        codec: "mjpeg",
        width,
        height,
        bitrate: 0,
        sampleCount: samples.length,
        duration,
        timescale: 0,
        language: "und",
        frameRate,
      },
    ],
    audioTracks: [],
    tags: { raw: {} },
  };
}

/**
 * Extracts Apple/QuickTime-style metadata tags from the moov box.
 * These live in the udta (User Data) box as ©-prefixed child boxes
 * (e.g. ©mak for camera make, ©mod for model, ©too for encoder).
 */
function extractMetadataTags(moov: mp4box.AllRegisteredBoxes["moov"]): MetadataTags {
  const tags: MetadataTags = { raw: {} };

  // Find the udta box in moov's children
  const udta = moov.boxes?.find((b) => b.type === "udta");
  if (!udta?.boxes) return tags;

  for (const child of udta.boxes) {
    const type = child.type;
    // Only process metadata boxes (typically start with ©)
    if (!type.startsWith("©")) continue;

    const value = readBoxStringValue(child);
    if (value === undefined) continue;

    tags.raw[type] = value;

    // Assign to the typed field if we have a mapping
    switch (type) {
      case "©too": tags.encoder = value; break;
      case "©mak": tags.make = value; break;
      case "©mod": tags.model = value; break;
      case "©swr": tags.software = value; break;
      case "©day": tags.creationDate = value; break;
      case "©nam": tags.title = value; break;
      case "©cpy": tags.copyright = value; break;
      case "©des": tags.description = value; break;
    }
  }

  return tags;
}

/**
 * Reads a string value from a metadata box. The value is typically stored
 * in a child data box (type "data") or directly in the box's data property.
 */
function readBoxStringValue(box: Box): string | undefined {
  // Try reading from a child "data" box first
  if (box.boxes) {
    for (const child of box.boxes) {
      if (child.type === "data") {
        const dataBox = child as mp4box.Box & { value?: string | number | bigint | boolean | object };
        if (typeof dataBox.value === "string") {
          return dataBox.value;
        }
      }
    }
  }

  // Fallback: decode the raw data as UTF-8, skipping the 16-byte data header
  // (type indicator + locale) that QuickTime/Apple metadata boxes use.
  if (box.data && box.data.length > 16) {
    try {
      // Skip the 8-byte box header and 8-byte data descriptor
      const decoder = new TextDecoder("utf-8");
      const text = decoder.decode(
        box.data instanceof Uint8Array
          ? box.data.slice(16)
          : new Uint8Array(box.data).slice(16),
      );
      return text.replace(/\0+$/, "") || undefined;
    } catch {
      // ignore decode errors
    }
  }

  return undefined;
}

/**
 * Pretty-prints VideoMetadata to the console.
 */
export function logMetadata(meta: VideoMetadata): void {
  console.log(`📹 ${meta.name}`);

  const t = meta.tags;
  const rows: Record<string, string | undefined> = {
    "File size": formatBytes(meta.fileSize),
    Container: meta.container,
    Duration: formatDurationHms(meta.duration),
    "Last modified": meta.lastModified.toLocaleString(),
    "MIME type": meta.mimeType,
    Brands: meta.brands.join(", ") || "—",
    Progressive: String(meta.isProgressive),
    Fragmented: String(meta.isFragmented),
    Camera: [t.make, t.model].filter(Boolean).join(" ") || undefined,
    Encoder: t.encoder,
    Software: t.software,
    Created: t.creationDate,
    Title: t.title,
    Copyright: t.copyright,
  };

  console.table(compact(rows));

  if (meta.videoTracks.length)
    console.table(meta.videoTracks.map(videoTrackRow));
  if (meta.audioTracks.length)
    console.table(meta.audioTracks.map(audioTrackRow));
  if (Object.keys(t.raw).length) console.table(t.raw);
}

type TrackRow = { Track: number; Codec: string; Duration: string; Bitrate: string; Language: string } & Record<string, string | number>;

function videoTrackRow(t: VideoTrackInfo, i: number): TrackRow {
  return {
    ...(t as unknown as Record<string, string | number>),
    Track: i + 1,
    Codec: t.codec,
    Resolution: `${t.width}×${t.height}`,
    "Frame rate": `${t.frameRate} fps`,
    Frames: t.sampleCount,
    Duration: formatDurationHms(t.duration),
    Bitrate: formatBitrate(t.bitrate),
    Language: t.language,
  };
}

function audioTrackRow(t: AudioTrackInfo, i: number): TrackRow {
  return {
    Track: i + 1,
    Codec: t.codec,
    "Sample rate": `${t.sampleRate} Hz`,
    Channels: t.channelCount,
    Duration: formatDurationHms(t.duration),
    Bitrate: formatBitrate(t.bitrate),
    Language: t.language,
  };
}

/** Drops undefined/null values from an object. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<T>;
}

function formatBytes(bytes: number): string {
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${["B", "KB", "MB", "GB"][i] ?? ""}`;
}

function formatBitrate(bps: number): string {
  return bps ? `${(bps / 1000).toFixed(0)} kbps` : "unknown";
}

function formatDurationHms(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}