import type { Meta, StoryObj } from "@storybook/html-vite";

const meta: Meta = {
  title: "Player/SampleTimeline",
  render: () => "<sample-timeline></sample-timeline>",
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
