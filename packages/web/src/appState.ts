import { analyzeNoise, type NoisePoint } from "./analyze";
import type { Sample } from "./decode/mjpeg";
import { getSamples } from "./decode/getSamples";

class AppUIAddFileEvent extends Event {
  file: File;

  constructor(file: File) {
    super("ui:addFile");
    this.file = file;
  }
}

export class AppUISelectFileEvent extends Event {
  file: File;

  constructor(file: File) {
    super("ui:selectFile");
    this.file = file;
  }
}

export class AppFileStatusChangeEvent extends Event {
  public file: File;
  status: string;

  constructor(status: string, file: File) {
    super("file:statusChange");
    this.status = status;
    this.file = file;
  }
}

export class AppFileNoiseAddedEvent extends Event {
  noisePoints: NoisePoint[];
  file: File;

  constructor(noisePoints: NoisePoint[], file: File) {
    super("file:noise:added");
    this.file = file;
    this.noisePoints = noisePoints;
  }
}

export class AppFileProgressEvent extends Event {
  progress: number;
  file: File;

  constructor(progress: number, file: File) {
    super("file:progress");
    this.progress = progress;
    this.file = file;
  }
}

export class AppFileErrorEvent extends Event {
  message: string;
  file: File;

  constructor(message: string, file: File) {
    super("file:error");
    this.file = file;
    this.message = message;
  }
}

const eventMap = {
  "ui:addFile": AppUIAddFileEvent,
  "ui:selectFile": AppUISelectFileEvent,
  "file:statusChange": AppFileStatusChangeEvent,
  "file:noise:added": AppFileNoiseAddedEvent,
  "file:progress": AppFileProgressEvent,
  "file:error": AppFileErrorEvent,
} as const;

type AppStateEventType = keyof typeof eventMap;

export type AppStateEvent<T extends AppStateEventType> = InstanceType<
  (typeof eventMap)[T]
>;

export type AppStateEventListener<T extends AppStateEventType> = (
  event: AppStateEvent<T>,
) => void;

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
    this.eventTarget.dispatchEvent(
      new AppFileStatusChangeEvent("Queued", file),
    );
    this.#processFile(file);
  }

  hasFile(file: File) {
    return this.files.some((existingFile) => existingFile.name === file.name);
  }

  addEventListener<T extends AppStateEventType>(
    eventType: T,
    eventListener: AppStateEventListener<T>,
  ) {
    // @ts-expect-error
    this.eventTarget.addEventListener(eventType, eventListener);
  }

  async #processFile(file: File) {
    this.eventTarget.dispatchEvent(
      new AppFileStatusChangeEvent("Reading", file),
    );

    try {
      this.eventTarget.dispatchEvent(new AppFileProgressEvent(0.1, file));
      const samples = await getSamples(file, (progress) =>
        this.eventTarget.dispatchEvent(
          new AppFileProgressEvent(progress * 0.45 + 0.1, file),
        ),
      );
      this.fileSamples.set(file, samples);

      this.eventTarget.dispatchEvent(
        new AppFileStatusChangeEvent("Analyzing", file),
      );
      const noise = await analyzeNoise(file, samples, (progress) =>
        this.eventTarget.dispatchEvent(
          new AppFileProgressEvent(progress * 0.45 + 0.55, file),
        ),
      );
      this.fileNoise.set(file, noise);
      this.eventTarget.dispatchEvent(new AppFileNoiseAddedEvent(noise, file));
    } catch (err) {
      this.eventTarget.dispatchEvent(
        new AppFileErrorEvent(
          err instanceof Error ? err.message : String(err),
          file,
        ),
      );
    }
  }
}
