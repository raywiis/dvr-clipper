import { NOISE_THRESHOLD, type NoisePoint } from "../../analyze";
import { assert } from "../../assert";
import styles from "./noiseChart.module.css";

export const NOISE_CHART_SEEK_EVENT = "noisechart:seek";

export class NoiseChartSeekEvent extends CustomEvent<{ time: number }> {
  constructor(time: number) {
    super(NOISE_CHART_SEEK_EVENT, { detail: { time } });
  }
}

function createNoiseChart(): SVGSVGElement {
  const chart = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chart.setAttribute("class", styles.chart!);
  chart.setAttribute("viewBox", "0 0 100 100");
  chart.setAttribute("preserveAspectRatio", "none");
  return chart;
}
function createSeekIndicator() {
  const seek = document.createElementNS("http://www.w3.org/2000/svg", "line");
  seek.setAttribute("y1", "0");
  seek.setAttribute("y2", "100");
  seek.setAttribute("vector-effect", "non-scaling-stroke");
  seek.setAttribute("class", styles.seekIndicator!);
  return seek;
}

export class NoiseChart extends HTMLElement {
  noisePoints: NoisePoint[] | null = null;
  #chartElement: SVGElement | null = null;
  #seekIndicator: SVGElement | null = null;

  constructor() {
    super();
  }

  connectedCallback() {
    this.#chartElement = createNoiseChart();
    this.#seekIndicator = createSeekIndicator();

    this.#seekIndicator.style.display = "none";

    this.#chartElement.append(this.#seekIndicator);
    this.appendChild(this.#chartElement);

    this.#chartElement.addEventListener("click", this.#onChartClick);
  }

  setNoisePoints(points: NoisePoint[]) {
    this.noisePoints = points;
    this.render();
  }

  setSeekPositionTime(time: number) {
    if (!this.noisePoints || this.noisePoints.length === 0) {
      return;
    }
    const duration = this.noisePoints.at(-1)?.time || 1;
    const x = Math.min((time / duration) * 100, 100);
    const seek = this.#seekIndicator;
    if (seek) {
      seek.setAttribute("x1", String(x));
      seek.setAttribute("x2", String(x));
      seek.style.display = "";
    }
  }

  #onChartClick = (event: MouseEvent) => {
    if (!this.noisePoints || this.noisePoints.length === 0) {
      return;
    }
    assert(this.#chartElement, "Missing chart element");
    const rect = this.#chartElement.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const duration = this.noisePoints.at(-1)?.time || 1;
    const time = ((event.clientX - rect.left) / rect.width) * duration;
    this.dispatchEvent(
      new NoiseChartSeekEvent(Math.max(0, Math.min(duration, time))),
    );
  };

  render() {
    if (!this.#chartElement) {
      return;
    }
    this.#chartElement.replaceChildren();
    if (!this.noisePoints) {
      return;
    }

    if (this.noisePoints.length === 0) {
      return;
    }
    const points = this.noisePoints;

    const duration = points.at(-1)?.time || 1;
    // Width per frame, from the frame interval — stays constant as points stream
    // in, rather than shrinking each time the array grows.
    const interval =
      points.length > 1
        ? (points[points.length - 1]!.time - points[0]!.time) /
          (points.length - 1)
        : duration;
    const barWidth = Math.max(0.4, Math.min(100, (interval / duration) * 100));

    for (const { time, score } of points) {
      const x = Math.min((time / duration) * 100, 100 - barWidth);
      const height = Math.max(1, score * 100);
      const bar = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      bar.setAttribute("x", String(x));
      bar.setAttribute("y", String(100 - height));
      bar.setAttribute("width", String(barWidth));
      bar.setAttribute("height", String(height));
      bar.setAttribute(
        "class",
        score >= NOISE_THRESHOLD ? styles.barNoisy! : styles.bar!,
      );
      this.#chartElement.append(bar);
    }

    const thresholdY = (1 - NOISE_THRESHOLD) * 100;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0");
    line.setAttribute("x2", "100");
    line.setAttribute("y1", String(thresholdY));
    line.setAttribute("y2", String(thresholdY));
    line.setAttribute("vector-effect", "non-scaling-stroke");
    line.setAttribute("class", styles.threshold!);
    this.#chartElement.append(line);

    assert(this.#seekIndicator, "Missing seek indicator for render");
    this.#chartElement.append(this.#seekIndicator);
  }
}
