import { NOISE_THRESHOLD, type NoisePoint } from './analyze';
import styles from './noiseChart.module.css';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Creates an empty, hidden noise-chart SVG. Populate it with {@link renderNoiseChart}. */
export function createNoiseChart(): SVGSVGElement {
  const chart = document.createElementNS(SVG_NS, 'svg');
  chart.setAttribute('class', styles.chart!);
  chart.setAttribute('viewBox', '0 0 100 100');
  chart.setAttribute('preserveAspectRatio', 'none');
  chart.setAttribute('aria-hidden', 'true');
  chart.setAttribute('hidden', '');
  return chart;
}

/**
 * Draws per-frame noise scores as bars along the clip's timeline (x = time).
 * Pass `totalDuration` when rendering partial results so bars stay anchored to
 * their true position instead of re-scaling as more points stream in.
 */
export function renderNoiseChart(chart: SVGElement, points: NoisePoint[], totalDuration?: number): void {
  chart.replaceChildren();
  if (points.length === 0) {
    chart.setAttribute('hidden', '');
    return;
  }

  const duration = totalDuration || points[points.length - 1]!.time || 1;
  // Width per frame, from the frame interval — stays constant as points stream
  // in, rather than shrinking each time the array grows.
  const interval =
    points.length > 1 ? (points[points.length - 1]!.time - points[0]!.time) / (points.length - 1) : duration;
  const barWidth = Math.max(0.4, Math.min(100, (interval / duration) * 100));

  for (const { time, score } of points) {
    const x = Math.min((time / duration) * 100, 100 - barWidth);
    const height = Math.max(1, score * 100);
    const bar = document.createElementNS(SVG_NS, 'rect');
    bar.setAttribute('x', String(x));
    bar.setAttribute('y', String(100 - height));
    bar.setAttribute('width', String(barWidth));
    bar.setAttribute('height', String(height));
    bar.setAttribute('class', score >= NOISE_THRESHOLD ? styles.barNoisy! : styles.bar!);
    chart.append(bar);
  }

  const thresholdY = (1 - NOISE_THRESHOLD) * 100;
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('x2', '100');
  line.setAttribute('y1', String(thresholdY));
  line.setAttribute('y2', String(thresholdY));
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  line.setAttribute('class', styles.threshold!);
  chart.append(line);

  chart.removeAttribute('hidden');
}
