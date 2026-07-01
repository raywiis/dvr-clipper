import type { Meta, StoryObj } from "@storybook/html-vite";
import { PlayButton } from "./PlayButton";

customElements.define("play-button", PlayButton, { extends: undefined });

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
  render: () => {
    const el = document.createElement("play-button");
    el.setAttribute("paused", "");
    el.id = "play-interactive";
    return el;
  },
  play: async ({ canvasElement }) => {
    const btn = canvasElement?.getElementById("play-interactive");
    if (!btn) return;
    const p = btn as HTMLElement & { play: () => void; pause: () => void };
    p.play();
    await new Promise((r) => setTimeout(r, 500));
    p.pause();
    await new Promise((r) => setTimeout(r, 500));
    p.play();
  },
};
