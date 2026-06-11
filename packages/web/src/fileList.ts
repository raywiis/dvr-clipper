import { type NoisePoint } from './analyze';
import { createNoiseChart, renderNoiseChart } from './noiseChart';
import styles from './fileList.module.css';

export type FileRow = {
  setProgress(fraction: number): void;
  setStatus(text: string): void;
  setReady(text?: string): void;
  setError(message: string): void;
  setActive(active: boolean): void;
  setNoise(points: NoisePoint[]): void;
};

export function renderFileList(
  container: HTMLUListElement,
  files: File[],
  onSelect: (file: File, index: number) => void,
): FileRow[] {
  container.replaceChildren();
  container.classList.add(styles.list!);
  container.hidden = files.length === 0;

  return files.map((file, index) => {
    const item = document.createElement('li');
    item.className = styles.item!;
    item.style.setProperty('--progress', '0');

    const header = document.createElement('div');
    header.className = styles.header!;

    const name = document.createElement('span');
    name.className = styles.name!;
    name.textContent = file.name;

    const status = document.createElement('span');
    status.className = styles.status!;
    status.textContent = 'Queued';

    header.append(name, status);

    const chart = createNoiseChart();

    item.append(header, chart);
    container.append(item);

    item.addEventListener('click', () => onSelect(file, index));

    const setProgress = (fraction: number) => {
      const clamped = Math.max(0, Math.min(1, fraction));
      item.style.setProperty('--progress', String(clamped));
    };

    return {
      setProgress,
      setStatus(text) {
        status.textContent = text;
      },
      setReady(text) {
        setProgress(1);
        item.classList.add(styles.isReady!);
        status.textContent = text ?? 'Ready';
      },
      setError(message) {
        setProgress(1);
        item.classList.add(styles.isError!);
        status.textContent = message;
      },
      setActive(active) {
        item.classList.toggle(styles.isActive!, active);
      },
      setNoise(points) {
        renderNoiseChart(chart, points);
      },
    };
  });
}
