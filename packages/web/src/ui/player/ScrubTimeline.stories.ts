import type { Meta, StoryObj } from "@storybook/html-vite";
import { ScrubTimeline } from "./ScrubTimeline";

const meta: Meta = {
  title: "Player/ScrubTimeline",
  render: () => "<scrub-timeline></scrub-timeline>",
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Ready: Story = {
  render: () => "<scrub-timeline></scrub-timeline>",
  play: async ({ canvasElement }) => {
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    const timeline = canvasElement
      ?.getElementsByTagName("scrub-timeline")
      .item(0);
    if (timeline instanceof ScrubTimeline) {
      timeline.configure(239, 10);
      timeline.seek(3, 72);
    }
  },
};
