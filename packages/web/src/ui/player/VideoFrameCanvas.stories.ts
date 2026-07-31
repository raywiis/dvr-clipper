import type { Meta, StoryObj } from "@storybook/html-vite";
import { VideoFrameCanvas } from "./VideoFrameCanvas";

const meta: Meta = {
  title: "Player/VideoFrameCanvas",
  render: () =>
    '<div style="width: 520px"><video-frame-canvas></video-frame-canvas></div>',
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const SampleFrame: Story = {
  play: async ({ canvasElement }) => {
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );

    const frameCanvas = canvasElement
      ?.getElementsByTagName("video-frame-canvas")
      .item(0);
    if (!(frameCanvas instanceof VideoFrameCanvas)) {
      return;
    }

    const file = await createSampleFrameFile();
    await frameCanvas.configure(file, [
      { offset: 0, size: file.size, time: 0 },
    ]);
  },
};

async function createSampleFrameFile() {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No story canvas context");
  }

  ctx.fillStyle = "#4f7cff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(96, 50, 128, 80);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Could not create sample frame"));
      },
      "image/jpeg",
      0.92,
    );
  });

  return new File([blob], "sample-frame.jpg", { type: "image/jpeg" });
}
