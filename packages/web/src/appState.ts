import type { NoisePoint } from "./analyze";
import type { Sample } from "./decode/mjpeg";

import {
  AppUIReorderFilesEvent,
  AppUIAddFileEvent,
  AppFileStatusChangeEvent,
  AppFileNoiseAddedEvent,
  AppFileAnalysisCompleteEvent,
  AppFileProgressEvent,
  AppFileErrorEvent,
  type AppStateEventType,
  type AppStateEventListener,
  AppFileSamplesAddedEvent,
} from "./appStateEvents";
import type {
  FileWorkerMessage,
  FileWorkerRequest,
} from "./fileWorker/messages";
import { assert } from "./assert";

const fileWorker = new Worker(
  new URL("./fileWorker/fileProcessingWorker.ts", import.meta.url),
  { type: "module" },
);

let nextRequestId = 0;

export class AppState {
  eventTarget = new EventTarget();
  files: File[] = [];
  fileSamples: Map<File, Sample[]> = new Map();
  fileNoise: Map<File, NoisePoint[]> = new Map();
  #pendingFileRequests = new Map<number, File>();

  constructor() {
    fileWorker.addEventListener("message", this.#handleFileWorkerMessage);
    fileWorker.addEventListener("error", (event) => {
      this.#reportAllFileErrors(event.message || "File worker failed.");
    });
    fileWorker.addEventListener("messageerror", () => {
      this.#reportAllFileErrors("Could not read a message from the worker.");
    });
  }

  addFile(file: File) {
    if (this.hasFile(file)) {
      return;
    }
    this.files.push(file);
    this.eventTarget.dispatchEvent(new AppUIAddFileEvent(file));
    this.#processFile(file);
  }

  hasFile(file: File) {
    return this.files.some((existingFile) => existingFile.name === file.name);
  }

  sortFilesByName() {
    this.files.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
    this.eventTarget.dispatchEvent(new AppUIReorderFilesEvent());
  }

  moveFile(file: File, targetIndex: number) {
    const index = this.files.indexOf(file);
    if (
      index < 0 ||
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= this.files.length ||
      targetIndex === index
    ) {
      return;
    }

    this.files.splice(index, 1);
    this.files.splice(targetIndex, 0, file);
    this.eventTarget.dispatchEvent(new AppUIReorderFilesEvent());
  }

  addEventListener<T extends AppStateEventType>(
    eventType: T,
    eventListener: AppStateEventListener<T>,
  ) {
    // @ts-expect-error
    this.eventTarget.addEventListener(eventType, eventListener);
  }

  #processFile(file: File) {
    const requestId = nextRequestId++;
    this.#pendingFileRequests.set(requestId, file);

    try {
      fileWorker.postMessage({ requestId, file } satisfies FileWorkerRequest);
    } catch (error) {
      this.#reportFileError(
        requestId,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  #handleFileWorkerMessage = ({ data }: MessageEvent<FileWorkerMessage>) => {
    const file = this.#pendingFileRequests.get(data.requestId);
    if (!file) return;

    switch (data.type) {
      case "progress":
        this.eventTarget.dispatchEvent(
          new AppFileProgressEvent(data.progress, file),
        );
        break;
      case "statusChange":
        this.eventTarget.dispatchEvent(
          new AppFileStatusChangeEvent(data.status, file),
        );
        break;
      case "samplesAdded":
        this.fileSamples.set(file, data.samples);
        this.eventTarget.dispatchEvent(
          new AppFileSamplesAddedEvent(data.samples, file),
        );
        break;
      case "noiseAdded":
        this.fileNoise.set(file, data.noisePoints);
        this.eventTarget.dispatchEvent(
          new AppFileNoiseAddedEvent(data.noisePoints, file),
        );
        break;
      case "processingComplete":
        const requestIdFile = this.#pendingFileRequests.get(data.requestId);
        assert(requestIdFile, "Invariant. Missing file for request id");
        const samples = this.fileSamples.get(requestIdFile);
        const noisePoints = this.fileNoise.get(requestIdFile);
        assert(samples, "Invariant. Missing samples after processing complete");
        assert(noisePoints, "Invariant. Missing noise after processing complete");
        this.#pendingFileRequests.delete(data.requestId);
        this.eventTarget.dispatchEvent(
          new AppFileAnalysisCompleteEvent(
            samples,
            noisePoints,
            file,
          ),
        );
        break;
      case "error":
        this.#reportFileError(data.requestId, data.message);
        break;
      default: {
        const unhandled: never = data;
        throw new Error(`Unknown worker message: ${unhandled}`);
      }
    }
  };

  #reportFileError(requestId: number, message: string) {
    const file = this.#pendingFileRequests.get(requestId);
    if (!file) return;

    this.#pendingFileRequests.delete(requestId);
    this.eventTarget.dispatchEvent(new AppFileErrorEvent(message, file));
  }

  #reportAllFileErrors(message: string) {
    for (const requestId of [...this.#pendingFileRequests.keys()]) {
      this.#reportFileError(requestId, message);
    }
  }
}
