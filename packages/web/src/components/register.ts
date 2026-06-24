import { PlayButton } from "./player/playButton";

export function registerCustomElements() {
  window.customElements.define('play-button', PlayButton, { extends: 'button' });
}
