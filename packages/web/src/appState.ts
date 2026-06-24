import type { Sample } from "./decode/mjpeg";

type AppStateEventType = 'addFile';

class AppAddFileEvent extends Event {
  addedFile: File;

  constructor(file: File) {
    super('addFile');
    this.addedFile = file;
  }
}

export type AppStateEvent = AppAddFileEvent;

export type AppStateEventListener<T extends AppStateEventType> = T extends 'addFile' ? (event: AppAddFileEvent) => void : never;

export class AppState {
  eventTarget = new EventTarget();
  files: File[] = []
  fileSamples: Map<File, Sample[]> = new Map();

  addFile(file: File) {
    if (this.hasFile(file)) {
      return;
    }
    this.files.push(file);
  }

  hasFile(file: File) {
    return this.files.some(existingFile => existingFile.name === file.name);
  }

  addEventListener<T extends AppStateEventType>(eventType: T, eventListener: AppStateEventListener<T>) {
    // @ts-expect-error
    this.eventTarget.addEventListener(eventType, eventListener);
  }
}
