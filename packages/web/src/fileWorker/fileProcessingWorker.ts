import { analyzeNoise } from "../analyze";
import { assert } from "../assert";
import { getSamples } from "../decode/getSamples";
import type { FileWorkerMessage, FileWorkerRequest } from "./messages";

const postMessage = (message: FileWorkerMessage) => {
  self.postMessage(message);
};

const queue: FileWorkerRequest[] = [];

const processFile = async ({ file, requestId }: FileWorkerRequest) => {
  try {
    assert(file instanceof File, "Invariant. Worker instance isn't a file");

    postMessage({ type: "statusChange", requestId, status: "Reading" });
    postMessage({ type: "progress", requestId, progress: 0.1 });

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
