import type { AppState } from "../../../appState";
import { assert } from "../../../assert";
import { FileListItem } from "../FileListItem/FileListItem";
import styles from "./fileList.module.css";

export const FILE_LIST_SELECT_EVENT = "file-select";

export class FileList extends HTMLElement {
  #appState: AppState | null = null;
  #entries = new Map<File, FileListItem>();
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

    this.#appState.addEventListener("ui:reorderFiles", () => {
      assert(this.#renderedList, "No rendered list when reordering");
      const focusedElement = document.activeElement;
      for (const [index, file] of appState.files.entries()) {
        const item = this.#entries.get(file);
        const currentItem = this.#renderedList.children[index];
        if (item && item !== currentItem) {
          this.#renderedList.insertBefore(item, currentItem ?? null);
        }
      }
      if (
        focusedElement instanceof HTMLElement &&
        this.contains(focusedElement)
      ) {
        focusedElement.focus();
      }
    });
  }

  #render() {
    if (this.#renderedList) {
      return;
    }

    this.classList.add(styles.host!);

    const sortButton = document.createElement("button");
    sortButton.type = "button";
    sortButton.className = styles.sortButton!;
    sortButton.textContent = "Sort by file name";
    sortButton.addEventListener("click", () => {
      assert(this.#appState, "no app state in render list");
      this.#appState.sortFilesByName();
    });
    this.append(sortButton);

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
    this.#entries.set(file, item);
  }
}
