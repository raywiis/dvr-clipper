export type Sample = {
  /** Absolute offset in the file, or null when the container loads frames lazily */
  offset: number | null;
  /** File size */
  size: number;
  /** Presentation time in seconds */
  time: number;
};

export type DecodedFrame = {
  time: number;
  bitmap: ImageBitmap;
};

export async function getArrayBuffer(
  file: File,
  sample: Sample,
): Promise<ArrayBuffer> {
  if (sample.offset === null) {
    const { getMovSampleData } = await import("./mov.ts");
    return getMovSampleData(file, sample);
  }

  const bytes = file.slice(sample.offset, sample.offset + sample.size);
  return bytes.arrayBuffer();
}

export async function decodeFrame(
  file: File,
  sample: Sample,
): Promise<DecodedFrame> {
  const bytes = await getArrayBuffer(file, sample);
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const bitmap = await createImageBitmap(blob);
  return { time: sample.time, bitmap };
}
