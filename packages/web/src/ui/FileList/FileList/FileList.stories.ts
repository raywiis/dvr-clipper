import type { Meta, StoryObj } from "@storybook/html-vite";
import {
  AppFileNoiseAddedEvent,
  AppFileProgressEvent,
  AppFileStatusChangeEvent,
  AppState,
} from "../../../appState";
import type { NoisePoint } from "../../../analyze";
import type { Sample } from "../../../decode/mjpeg";
import { FileList } from "./FileList";

const meta: Meta = {
  title: "FileList/FileList",
  render: () => "<file-list></file-list>",
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof meta>;

const file = new File([""], "flight-001.mov", { type: "video/quicktime" });

const samples: Sample[] = Array.from({ length: 12 }, (_, index) => ({
  offset: index * 1000,
  size: 1000,
  time: index * 0.5,
}));

const noisePoints: NoisePoint[] = samples.map((sample, index) => ({
  time: sample.time,
  score: index % 4 === 0 ? 0.8 : 0.18,
}));

function createConfiguredFileList() {
  const state = new AppState();
  state.files.push(file);
  const list = document.createElement("file-list");
  if (list instanceof FileList) {
    list.configure(state);
  }
  return { list, state };
}

export const Queued: Story = {
  render: () => {
    const { list, state } = createConfiguredFileList();
    return list;
  },
};

export const Reading: Story = {
  render: () => {
    const { list, state } = createConfiguredFileList();
    state.eventTarget.dispatchEvent(
      new AppFileStatusChangeEvent("Reading", file),
    );
    state.eventTarget.dispatchEvent(new AppFileProgressEvent(0.35, file));
    return list;
  },
};

export const Ready: Story = {
  render: () => {
    const { list, state } = createConfiguredFileList();
    state.fileSamples.set(file, samples);
    state.eventTarget.dispatchEvent(
      new AppFileNoiseAddedEvent(noisePoints, file),
    );
    return list;
  },
};
