import type { AppState } from "../../../appState";
import { assert } from "../../../assert";
import { FileListItem } from "../FileListItem/FileListItem";
import styles from "./fileList.module.css";

export const FILE_LIST_SELECT_EVENT = "file-select";

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

    this.#appState.addEventListener("ui:addFile", (event) => {
      this.#renderFile(event.file);
    });
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

    const item = new FileListItem(this.#appState, file);

    this.#renderedList.append(item);
    this.#entries.add(file);
  }
}
