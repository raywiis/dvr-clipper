export type FileRow = {
  setProgress(fraction: number): void;
  setStatus(text: string): void;
  setReady(text?: string): void;
  setError(message: string): void;
  setActive(active: boolean): void;
};

export function renderFileList(
  container: HTMLUListElement,
  files: File[],
  onSelect: (file: File, index: number) => void,
): FileRow[] {
  container.replaceChildren();
  container.hidden = files.length === 0;

  return files.map((file, index) => {
    const item = document.createElement('li');
    item.className = 'filelist-item';
    item.style.setProperty('--progress', '0');

    const name = document.createElement('span');
    name.className = 'filelist-name';
    name.textContent = file.name;

    const status = document.createElement('span');
    status.className = 'filelist-status';
    status.textContent = 'Queued';

    item.append(name, status);
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
        item.classList.add('is-ready');
        status.textContent = text ?? 'Ready';
      },
      setError(message) {
        setProgress(1);
        item.classList.add('is-error');
        status.textContent = message;
      },
      setActive(active) {
        item.classList.toggle('is-active', active);
      },
    };
  });
}
