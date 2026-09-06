import type { NoisePoint } from "../analyze";
import type { Sample } from "../decode/mjpeg";

export type FileWorkerRequest = {
  requestId: number;
  file: File;
};

// Plain data only: app events are constructed by AppState on the main thread.
export type FileWorkerMessage = { requestId: number } & (
  | { type: "progress"; progress: number }
  | { type: "samplesAdded"; samples: Sample[] }
  | { type: "statusChange"; status: string }
  | { type: "noiseAdded"; noisePoints: NoisePoint[] }
  | { type: "analysisComplete"; samples: Sample[]; noisePoints: NoisePoint[] }
  | { type: "error"; message: string }
);
