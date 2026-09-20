import type { AppState } from "../../appState";
import { formatDuration } from "../../formatDuration";
import {
  getNoiselessGroupsFromFiles,
  type Groups,
} from "../../getNoiselessGroupsFromFiles";
import styles from "./exportedVideos.module.css";

export const EXPORT_VIDEOS_REQUEST_EVENT = "exported-videos:export";

export class ExportVideosRequestEvent extends CustomEvent<{
  groups: Groups;
}> {
  constructor(groups: Groups) {
    super(EXPORT_VIDEOS_REQUEST_EVENT, {
      detail: { groups },
    });
  }
}

export class ExportedVideos extends HTMLElement {
  #appState: AppState | null = null;
  #durationValue: HTMLElement | null = null;
  #exportButton: HTMLButtonElement | null = null;
  #exportDurationValue: HTMLElement | null = null;
  #groups: Groups | null = null;
  #groupsValue: HTMLElement | null = null;
  #readyValue: HTMLElement | null = null;
  #rendered = false;
  #summary: HTMLSpanElement | null = null;

  connectedCallback() {
    if (this.#rendered) {
      return;
    }

    this.#rendered = true;
    this.classList.add(styles.host!);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.append("Exported videos (");

    const summary = document.createElement("span");
    summary.textContent = "0:00 total";
    summary.setAttribute("aria-live", "polite");
    this.#summary = summary;

    trigger.append(summary, ")");

    const dialog = this.#createDialog();
    trigger.addEventListener("click", () => {
      this.#prepareGroups();
      this.#updateDetails();
      dialog.showModal();
    });

    this.append(trigger, dialog);
    this.#updateDetails();
  }

  configure(appState: AppState) {
    this.#appState = appState;
    this.#updateDetails();
    appState.addEventListener("ui:addFile", () => {
      this.#invalidateGroups();
    });
    appState.addEventListener("file:samples:added", () => {
      this.#invalidateGroups();
    });
    appState.addEventListener("file:noise:added", () => {
      this.#invalidateGroups();
    });
  }

  #createDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = styles.dialog!;

    const header = document.createElement("div");
    header.className = styles.dialogHeader!;

    const heading = document.createElement("h2");
    heading.className = styles.dialogTitle!;
    heading.textContent = "Export configuration";

    const description = document.createElement("p");
    description.className = styles.description!;
    description.textContent =
      "Export clips without static from all analyzed videos.";
    header.append(heading, description);

    const stats = document.createElement("dl");
    stats.className = styles.stats!;

    const readyLabel = document.createElement("dt");
    readyLabel.textContent = "Videos ready";
    const readyValue = document.createElement("dd");
    readyValue.textContent = "0 of 0";
    this.#readyValue = readyValue;

    const durationLabel = document.createElement("dt");
    durationLabel.textContent = "Combined duration";
    const durationValue = document.createElement("dd");
    durationValue.textContent = "0:00";
    this.#durationValue = durationValue;

    const groupsLabel = document.createElement("dt");
    groupsLabel.textContent = "Groups";
    const groupsValue = document.createElement("dd");
    groupsValue.textContent = "—";
    this.#groupsValue = groupsValue;

    const exportDurationLabel = document.createElement("dt");
    exportDurationLabel.textContent = "Export duration";
    const exportDurationValue = document.createElement("dd");
    exportDurationValue.textContent = "—";
    this.#exportDurationValue = exportDurationValue;

    stats.append(
      readyLabel,
      readyValue,
      durationLabel,
      durationValue,
      groupsLabel,
      groupsValue,
      exportDurationLabel,
      exportDurationValue,
    );

    const actions = document.createElement("div");
    actions.className = styles.actions!;

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => dialog.close());

    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "Export clips";
    exportButton.disabled = true;
    exportButton.addEventListener("click", () => {
      if (!this.#groups) {
        return;
      }
      this.dispatchEvent(new ExportVideosRequestEvent(this.#groups));
      dialog.close();
    });
    this.#exportButton = exportButton;

    actions.append(cancelButton, exportButton);
    dialog.append(header, stats, actions);
    return dialog;
  }

  #updateDetails() {
    if (!this.#appState) {
      return;
    }

    const totalDuration = [...this.#appState.fileSamples.values()].reduce(
      (total, samples) => total + (samples.at(-1)?.time ?? 0),
      0,
    );
    const readyCount = this.#appState.files.filter(
      (file) =>
        this.#appState?.fileSamples.has(file) &&
        this.#appState.fileNoise.has(file),
    ).length;
    const batchIsReady =
      this.#appState.files.length > 0 &&
      readyCount === this.#appState.files.length;
    const formattedDuration = formatDuration(totalDuration);

    if (this.#summary) {
      this.#summary.textContent = `${formattedDuration} total`;
    }
    if (this.#durationValue) {
      this.#durationValue.textContent = formattedDuration;
    }
    if (this.#readyValue) {
      this.#readyValue.textContent = `${readyCount} of ${this.#appState.files.length}`;
    }
    if (this.#groupsValue) {
      this.#groupsValue.textContent = this.#groups
        ? String(this.#groups.length)
        : "—";
    }
    if (this.#exportDurationValue) {
      this.#exportDurationValue.textContent = this.#groups
        ? formatDuration(
            this.#groups
              .flat()
              .reduce(
                (total, section) =>
                  total +
                  Math.max(
                    0,
                    (section.samples.at(-1)?.time ?? 0) -
                      (section.samples.at(0)?.time ?? 0),
                  ),
                0,
              ),
          )
        : "—";
    }
    if (this.#exportButton) {
      this.#exportButton.disabled =
        !batchIsReady || !this.#groups || this.#groups.length === 0;
    }
  }

  #invalidateGroups() {
    this.#groups = null;
    this.#updateDetails();
  }

  #prepareGroups() {
    if (!this.#appState || this.#groups) {
      return;
    }
    const batchIsReady =
      this.#appState.files.length > 0 &&
      this.#appState.files.every(
        (file) =>
          this.#appState?.fileSamples.has(file) &&
          this.#appState.fileNoise.has(file),
      );
    if (batchIsReady) {
      this.#groups = getNoiselessGroupsFromFiles(
        this.#appState,
        this.#appState.files,
      );
    }
  }
}
