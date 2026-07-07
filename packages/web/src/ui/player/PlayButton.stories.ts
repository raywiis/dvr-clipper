import type { Meta, StoryObj } from "@storybook/html-vite";
import { PlayButton } from "./PlayButton";

const meta: Meta = {
  title: "Player/PlayButton",
  render: () => "<play-button></play-button>",
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Paused: Story = {
  render: () => "<play-button paused></play-button>",
};

export const Playing: Story = {
  render: () => "<play-button></play-button>",
};

export const Interactive: Story = {
  render: () => '<play-button paused=""></play-button>',
  play: async ({ canvasElement }) => {
    const btn = canvasElement?.getElementsByTagName("play-button").item(0);
    if (!btn || !(btn instanceof PlayButton)) return;
    btn.addEventListener("click", () => {
      if (btn.hasAttribute("paused")) {
        btn.play();
      } else {
        btn.pause();
      }
    });
  },
};
