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
    const cleanup = () => {
      fileWorker.removeEventListener("message", onMessage);
      fileWorker.removeEventListener("error", onError);
      fileWorker.removeEventListener("messageerror", onMessageError);
    };
    const reportError = (message: string) => {
      cleanup();
      this.eventTarget.dispatchEvent(new AppFileErrorEvent(message, file));
    };
    const onMessage = ({ data }: MessageEvent<FileWorkerMessage>) => {
      if (data.requestId !== requestId) return;

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
        case "analysisComplete":
          cleanup();
          this.eventTarget.dispatchEvent(
            new AppFileAnalysisCompleteEvent(
              data.samples,
              data.noisePoints,
              file,
            ),
          );
          break;
        case "error":
          reportError(data.message);
          break;
        default: {
          const unhandled: never = data;
          throw new Error(`Unknown worker message: ${unhandled}`);
        }
      }
    };
    const onError = (event: ErrorEvent) => {
      reportError(event.message || "File worker failed.");
    };
    const onMessageError = () => {
      reportError("Could not read a message from the worker.");
    };

    fileWorker.addEventListener("message", onMessage);
    fileWorker.addEventListener("error", onError);
    fileWorker.addEventListener("messageerror", onMessageError);

    try {
      fileWorker.postMessage({ requestId, file } satisfies FileWorkerRequest);
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error));
    }
  }
}
