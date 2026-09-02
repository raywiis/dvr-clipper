import type { AppState } from "../../../appState";
import { assert } from "../../../assert";
import { FileListItem } from "../FileListItem/FileListItem";
import styles from "./fileList.module.css";

export const FILE_LIST_SELECT_EVENT = "file-select";

export class FileListSelectEvent extends CustomEvent<{ file: File }> {
  constructor(file: File) {
    super(FILE_LIST_SELECT_EVENT, {
      bubbles: true,
      detail: { file },
    });
  }
}

type FileListEventMap = {
  [FILE_LIST_SELECT_EVENT]: FileListSelectEvent;
};

export class FileList extends HTMLElement {
  #appState: AppState | null = null;
  #entries = new Set<File>();
  #renderedList: HTMLUListElement | null = null;

  connectedCallback() {
    this.#render();
  }

  configure(appState: AppState) {
    this.#appState = appState;
    this.#render();
    for (const file of appState.files) {
      this.#renderFile(file);
    }

    appState.addEventListener("ui:addFile", (event) => {
      this.#renderFile(event.addedFile);
    });
  }

  addEventListener<K extends keyof FileListEventMap>(
    type: K,
    listener: (this: FileList, event: FileListEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) {
      return;
    }
    super.addEventListener(type, listener, options);
  }

  #render() {
    if (this.#renderedList) {
      return;
    }

    this.classList.add(styles.host!);

    const list = document.createElement("ul");
    list.className = styles.list!;
    this.append(list);
    this.#renderedList = list;
  }

  #renderFile(file: File) {
    if (this.#entries.has(file)) {
      return;
    }

    this.#render();
    assert(this.#renderedList, "Invariant: No rendered list");
    assert(this.#appState, "Invariant: No app state when adding file");

    const item = new FileListItem(this.#appState, file)

    this.#renderedList.append(item);
    this.#entries.add(file);
  }
}
