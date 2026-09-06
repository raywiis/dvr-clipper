import type { NoisePoint } from "./analyze";
import type { Sample } from "./decode/mjpeg";

export class AppUIReorderFilesEvent extends Event {
  constructor() {
    super("ui:reorderFiles");
  }
}

export class AppUIAddFileEvent extends Event {
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

export class AppFileSamplesAddedEvent extends Event {
  samples: Sample[];
  file: File;

  constructor(samples: Sample[], file: File) {
    super("file:samples:added");
    this.samples = samples;
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

export class AppFileAnalysisCompleteEvent extends Event {
  samples: Sample[];
  noisePoints: NoisePoint[];
  file: File;

  constructor(samples: Sample[], noisePoints: NoisePoint[], file: File) {
    super("file:analysisComplete");
    this.samples = samples;
    this.noisePoints = noisePoints;
    this.file = file;
  }
}

const eventMap = {
  "file:analysisComplete": AppFileAnalysisCompleteEvent,
  "ui:reorderFiles": AppUIReorderFilesEvent,
  "ui:addFile": AppUIAddFileEvent,
  "ui:selectFile": AppUISelectFileEvent,
  "file:statusChange": AppFileStatusChangeEvent,
  "file:samples:added": AppFileSamplesAddedEvent,
  "file:noise:added": AppFileNoiseAddedEvent,
  "file:progress": AppFileProgressEvent,
  "file:error": AppFileErrorEvent,
} as const;

export type AppStateEventType = keyof typeof eventMap;

export type AppStateEvent<T extends AppStateEventType> = InstanceType<
  (typeof eventMap)[T]
>;

export type AppStateEventListener<T extends AppStateEventType> = (
  event: AppStateEvent<T>,
) => void;

export function isAppStateEvent<T extends AppStateEventType>(
  type: T,
  event: unknown,
): event is AppStateEvent<T> {
  return (
    typeof event === "object" &&
    !!event &&
    "type" in event &&
    event.type === type
  );
}
