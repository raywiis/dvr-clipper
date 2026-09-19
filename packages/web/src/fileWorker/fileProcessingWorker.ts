import { analyzeNoise } from "../analyze";
import { assert } from "../assert";
import { streamSamples } from "../decode/getSamples";
import type { FileWorkerMessage, FileWorkerRequest } from "./messages";

const postMessage = (message: FileWorkerMessage) => {
  self.postMessage(message);
};

const PROGRESS_RATIOS = {
  QUEUEING: 0.1,
  SAMPLE_PROCESSING: 0.45,
  NOISE_PROCESSING: 0.45,
} as const;

const queue: FileWorkerRequest[] = [];

const processFile = async ({ file, requestId }: FileWorkerRequest) => {
  try {
    assert(file instanceof File, "Invariant. Worker instance isn't a file");

    postMessage({ type: "statusChange", requestId, status: "Reading" });
    postMessage({
      type: "progress",
      requestId,
      progress: PROGRESS_RATIOS.QUEUEING,
    });

    const samples = [];
    const sampleStream = streamSamples(file);
    for await (const { sample, progress } of sampleStream) {
      samples.push(sample);
      postMessage({
        type: "progress",
        requestId,
        progress: progress * PROGRESS_RATIOS.SAMPLE_PROCESSING + PROGRESS_RATIOS.QUEUEING,
      });
    }
    postMessage({ type: "samplesAdded", requestId, samples });
    postMessage({ type: "statusChange", requestId, status: "Analyzing" });

    const noisePoints = await analyzeNoise(file, samples, (progress) =>
      postMessage({
        type: "progress",
        requestId,
        progress:
          progress * PROGRESS_RATIOS.NOISE_PROCESSING +
          PROGRESS_RATIOS.SAMPLE_PROCESSING +
          PROGRESS_RATIOS.QUEUEING,
      }),
    );
    postMessage({ type: "noiseAdded", requestId, noisePoints });
    postMessage({
      type: "processingComplete",
      requestId,
    });
  } catch (error) {
    postMessage({
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

let isProcessing = false;
async function processQueue() {
  if (isProcessing) return;

  isProcessing = true;

  while (queue.length > 0) {
    const request = queue.shift();
    assert(request, "Invariant. File processing queue is empty");
    await processFile(request);
  }

  isProcessing = false;
}

self.addEventListener("message", (event: MessageEvent<FileWorkerRequest>) => {
  queue.push(event.data);
  postMessage({
    type: "statusChange",
    requestId: event.data.requestId,
    status: "Queued",
  });
  void processQueue();
});
