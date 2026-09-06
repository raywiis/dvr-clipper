import { analyzeNoise } from "../analyze";
import { assert } from "../assert";
import { getSamples } from "../decode/getSamples";
import type { FileWorkerMessage, FileWorkerRequest } from "./messages";

const postMessage = (message: FileWorkerMessage) => {
  self.postMessage(message);
};

self.addEventListener(
  "message",
  async (event: MessageEvent<FileWorkerRequest>) => {
    const { file, requestId } = event.data;

    try {
      assert(file instanceof File, "Invariant. Worker instance isn't a file");

      const samples = await getSamples(file, (progress) =>
        postMessage({
          type: "progress",
          requestId,
          progress: progress * 0.45 + 0.1,
        }),
      );
      postMessage({ type: "samplesAdded", requestId, samples });
      postMessage({ type: "statusChange", requestId, status: "Analyzing" });

      const noisePoints = await analyzeNoise(file, samples, (progress) =>
        postMessage({
          type: "progress",
          requestId,
          progress: progress * 0.45 + 0.55,
        }),
      );
      postMessage({ type: "noiseAdded", requestId, noisePoints });
      postMessage({
        type: "analysisComplete",
        requestId,
        samples,
        noisePoints,
      });
    } catch (error) {
      postMessage({
        type: "error",
        requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
