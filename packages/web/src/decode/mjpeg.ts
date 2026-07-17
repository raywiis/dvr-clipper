export type Sample = {
  /** Absolute offset in the file */
  offset: number;
  /** File size */
  size: number;
  /** Presentation time in seconds */
  time: number;
};

export type DecodedFrame = {
  time: number;
  bitmap: ImageBitmap;
};

export function getArrayBuffer(file: File, sample: Sample) {
  const bytes = file.slice(sample.offset, sample.offset + sample.size);
  return bytes.arrayBuffer();
}

export async function decodeFrame(
  file: File,
  sample: Sample,
): Promise<DecodedFrame> {
  const bytes = file.slice(sample.offset, sample.offset + sample.size);
  const blob = new Blob([bytes as BlobPart], { type: "image/jpeg" });
  const bitmap = await createImageBitmap(blob);
  return { time: sample.time, bitmap };
}
