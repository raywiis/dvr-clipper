import type { Meta, StoryObj } from "@storybook/html-vite";
import { NoiseChart } from "./NoiseChart";
import type { NoisePoint } from "../../analyze";

customElements.define("noise-chart", NoiseChart, { extends: undefined });

const mockPoints: NoisePoint[] = [
  { time: 0, score: 0.1 },
  { time: 0.5, score: 0.15 },
  { time: 1, score: 0.8 },
  { time: 1.5, score: 0.9 },
  { time: 2, score: 0.2 },
  { time: 2.5, score: 0.3 },
  { time: 3, score: 0.75 },
  { time: 3.5, score: 0.85 },
  { time: 4, score: 0.1 },
  { time: 4.5, score: 0.12 },
];

const meta: Meta = {
  title: "NoiseChart/NoiseChart",
  render: () => "<noise-chart></noise-chart>",
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => "<noise-chart></noise-chart>",
};

export const WithData: Story = {
  render: () => {
    const el = document.createElement("noise-chart");
    el.setAttribute("id", "noise-with-data");
    el.setAttribute("hidden", "");
    return el;
  },
  play: async ({ canvasElement }) => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const chart = canvasElement?.getElementById("noise-with-data");
    if (chart) {
      (chart as HTMLElement & { setNoisePoints: (p: NoisePoint[]) => void }).setNoisePoints(mockPoints);
      chart.hidden = false;
    }
  },
};

export const MostlyNoisy: Story = {
  render: () => {
    const el = document.createElement("noise-chart");
    el.setAttribute("id", "noise-noisy");
    el.setAttribute("hidden", "");
    return el;
  },
  play: async ({ canvasElement }) => {
    const noisy: NoisePoint[] = Array.from({ length: 20 }, (_, i) => ({
      time: i * 0.5,
      score: Math.random() > 0.3 ? Math.random() * 0.5 + 0.5 : Math.random() * 0.3,
    }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const chart = canvasElement?.getElementById("noise-noisy");
    if (chart) {
      (chart as HTMLElement & { setNoisePoints: (p: NoisePoint[]) => void }).setNoisePoints(noisy);
      chart.hidden = false;
    }
  },
};
