import type { Meta, StoryObj } from "@storybook/html-vite";
import type { NoisePoint } from "../../analyze";
import { NoiseChart } from "./NoiseChart";

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
  render: () => "<noise-chart></noise-chart>",
  play: async ({ canvasElement }) => {
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    const chart = canvasElement?.getElementsByTagName("noise-chart").item(0);
    if (chart && chart instanceof NoiseChart) {
      chart.setNoisePoints(mockPoints);
    }
  },
};

export const MostlyNoisy: Story = {
  render: () => "<noise-chart></noise-chart>",
  play: async ({ canvasElement }) => {
    const noisy: NoisePoint[] = Array.from({ length: 20 }, (_, i) => ({
      time: i * 0.5,
      score:
        Math.random() > 0.3 ? Math.random() * 0.5 + 0.5 : Math.random() * 0.3,
    }));
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    const chart = canvasElement?.getElementsByTagName("noise-chart").item(0);
    if (chart && chart instanceof NoiseChart) {
      chart.setNoisePoints(noisy);
    }
  },
};
