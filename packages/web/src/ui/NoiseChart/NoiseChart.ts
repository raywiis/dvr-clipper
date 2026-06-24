import { NOISE_THRESHOLD, type NoisePoint } from '../../analyze';
import styles from './noiseChart.module.css';

function createNoiseChart(): SVGSVGElement {
  const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chart.setAttribute('class', styles.chart!);
  chart.setAttribute('viewBox', '0 0 100 100');
  chart.setAttribute('preserveAspectRatio', 'none');
  return chart;
}

export class NoiseChart extends HTMLElement {
  chartElement: SVGElement | null = null;
  noisePoints: NoisePoint[] | null = null;

  constructor() {
    super();
  }

  connectedCallback() {
    const chart = createNoiseChart();
    this.appendChild(chart);
    this.chartElement = chart;
  }

  setNoisePoints(points: NoisePoint[]) {
    this.noisePoints = points;
    this.render();
  }

  render() {
    if (!this.chartElement) {
      return;
    }
    this.chartElement.replaceChildren();
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
      points.length > 1 ? (points[points.length - 1]!.time - points[0]!.time) / (points.length - 1) : duration;
    const barWidth = Math.max(0.4, Math.min(100, (interval / duration) * 100));

    for (const { time, score } of points) {
      const x = Math.min((time / duration) * 100, 100 - barWidth);
      const height = Math.max(1, score * 100);
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('x', String(x));
      bar.setAttribute('y', String(100 - height));
      bar.setAttribute('width', String(barWidth));
      bar.setAttribute('height', String(height));
      bar.setAttribute('class', score >= NOISE_THRESHOLD ? styles.barNoisy! : styles.bar!);
      this.chartElement.append(bar);
    }

    const thresholdY = (1 - NOISE_THRESHOLD) * 100;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('x2', '100');
    line.setAttribute('y1', String(thresholdY));
    line.setAttribute('y2', String(thresholdY));
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    line.setAttribute('class', styles.threshold!);
    this.chartElement.append(line);
  }
}
