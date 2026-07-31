import { type NoisePoint } from "../../analyze";
import { type Sample } from "../../decode/mjpeg";
import { NoiseChart } from "../NoiseChart/NoiseChart";
import { PlayButton } from "./PlayButton";
import { ScrubTimeline } from "./ScrubTimeline";
import { VideoFrameCanvas } from "./VideoFrameCanvas";
import styles from "./player.module.css";

export class Player extends HTMLElement {
  #frameCanvas: VideoFrameCanvas | null = null;
  #timeline: ScrubTimeline | null = null;
  #noise: NoiseChart | null = null;
  #playButton: PlayButton | null = null;
  #playbackId = 0;
  #activePlaybackId: number | null = null;

  connectedCallback() {
    this.#render();
  }

  disconnectedCallback() {
    this.#stopActivePlayback();
  }

  async load(file: File, samples: Sample[], noise: NoisePoint[]) {
    const { frameCanvas, timeline, playButton, noiseChart } = this.#render();

    const playbackId = this.#startPlayback();
    noiseChart.setNoisePoints(noise);

    await frameCanvas.configure(file, samples);
    if (!this.#isPlaybackActive(playbackId)) {
      return;
    }
    const isPlaybackActive = () => this.#isPlaybackActive(playbackId);

    const lastFrame = samples.length - 1;
    const duration = samples[lastFrame]!.time;

    timeline.configure(lastFrame, duration);

    /** Largest sample index whose presentation time is <= t (binary search). */
    function indexAtTime(t: number): number {
      if (t <= samples[0]!.time) return 0;
      if (t >= samples[lastFrame]!.time) return lastFrame;
      let lo = 0;
      let hi = lastFrame;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (samples[mid]!.time <= t) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    }

    function showFrame(index: number) {
      timeline.seek(samples[index]!.time, index);
      return frameCanvas.showFrame(index);
    }

    // Playback advances by wall-clock time against the samples' own timestamps,
    // so it tracks the clip's real frame rate and drops frames if decoding lags.
    let playing = false;
    let rafId = 0;
    let anchorWall = 0; // performance.now() when playback (re)started
    let anchorTime = 0; // clip time at that moment

    function tick() {
      if (!isPlaybackActive() || !playing) return;
      const elapsed = anchorTime + (performance.now() - anchorWall) / 1000;
      showFrame(indexAtTime(elapsed));
      if (elapsed >= duration) {
        pause();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function play() {
      if (!isPlaybackActive() || playing) return;
      // Restart from the beginning if we're parked at the end.
      const startIndex = timeline.value >= lastFrame ? 0 : timeline.value;
      anchorTime = samples[startIndex]!.time;
      anchorWall = performance.now();
      playing = true;
      playButton.play();
      rafId = requestAnimationFrame(tick);
    }

    function pause() {
      if (!playing) return;
      playing = false;
      cancelAnimationFrame(rafId);
      playButton.pause();
    }

    playing = false;
    playButton.pause();

    playButton.onclick = () => (playing ? pause() : play());

    const onTimelineInput = () => {
      if (!isPlaybackActive()) return;
      const index = timeline.value;
      // Re-anchor so playback continues smoothly from where the user dragged.
      anchorTime = samples[index]!.time;
      anchorWall = performance.now();
      showFrame(index);
    };
    timeline.addEventListener("input", onTimelineInput);
  }

  #startPlayback() {
    this.#stopActivePlayback();
    this.#playbackId += 1;
    this.#activePlaybackId = this.#playbackId;
    return this.#playbackId;
  }

  #stopActivePlayback() {
    if (this.#activePlaybackId === null) {
      return;
    }

    this.#activePlaybackId = null;
    this.#playButton?.pause();
  }

  #isPlaybackActive(playbackId: number) {
    return this.#activePlaybackId === playbackId;
  }

  #render() {
    this.classList.add(styles.host!);

    if (
      this.#frameCanvas &&
      this.#timeline &&
      this.#noise &&
      this.#playButton
    ) {
      return {
        frameCanvas: this.#frameCanvas,
        timeline: this.#timeline,
        noiseChart: this.#noise,
        playButton: this.#playButton,
      };
    }

    const stage = document.createElement("div");
    stage.className = styles.stage!;

    const frameCanvas = new VideoFrameCanvas();
    stage.append(frameCanvas);

    const timelineWrapper = document.createElement("div");
    timelineWrapper.className = styles.timeline!;

    const noiseChart = new NoiseChart();
    noiseChart.className = styles.timelineNoise!;

    const timeline = new ScrubTimeline();
    timeline.className = styles.timelineScrub!;

    const controls = document.createElement("div");
    const playButton = new PlayButton();
    playButton.className = styles.playButton!;
    controls.append(playButton);

    timelineWrapper.append(noiseChart, timeline, controls);
    this.append(stage, timelineWrapper);

    this.#frameCanvas = frameCanvas;
    this.#timeline = timeline;
    this.#noise = noiseChart;
    this.#playButton = playButton;

    return { frameCanvas, timeline, noiseChart, playButton };
  }
}
