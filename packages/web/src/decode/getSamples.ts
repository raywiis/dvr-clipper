import { type Sample } from "./mjpeg.ts";
import { getDemuxedSamples } from "./webDemuxer.ts";

export async function getSamples(
  file: File,
  onProgress: (progress: number) => void,
): Promise<Sample[]> {
  return getDemuxedSamples(file, onProgress);
}
