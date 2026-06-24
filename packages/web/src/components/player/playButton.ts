
const playIconSvg = /*html*/`
<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path class="icon-play" d="M8 5v14l11-7z" fill="currentColor"></path>
</svg>
`

const pauseIconSvg = `
<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <rect class="icon-pause" x="6" y="5" width="4" height="14" fill="currentColor"></rect>
  <rect class="icon-pause" x="14" y="5" width="4" height="14" fill="currentColor"></rect>
</svg>
`

const PAUSED_ATTRIBUTE = 'paused'

export class PlayButton extends HTMLElement {
  static observedAttributes = [PAUSED_ATTRIBUTE]
  constructor() {
    super();
  }

  connectedCallback() {
    this.render()
  }

  attributeChangedCallback(name: string) {
    if (name === PAUSED_ATTRIBUTE) {
      this.render();
    }
  }

  play() {
    this.removeAttribute(PAUSED_ATTRIBUTE);
  }

  pause() {
    this.setAttribute(PAUSED_ATTRIBUTE, '');
  }

  private render() {
    const pausedAttributeValue = this.getAttribute(PAUSED_ATTRIBUTE);
    if (pausedAttributeValue === null) {
      this.innerHTML = pauseIconSvg;
    } else {
      this.innerHTML = playIconSvg;
    }
  }
}
