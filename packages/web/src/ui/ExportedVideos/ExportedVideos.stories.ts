import type { Meta, StoryObj } from "@storybook/html-vite";

const meta: Meta = {
  title: "ExportedVideos/ExportedVideos",
  render: () => "<exported-videos></exported-videos>",
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
