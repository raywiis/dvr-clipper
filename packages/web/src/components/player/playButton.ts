
export class PlayButton extends HTMLButtonElement {
  constructor() {
    super();
  }

  // <button type="button" class="play-button" disabled>
  //   <svg viewBox="0 0 24 24" aria-hidden="true">
  //     <path class="icon-play" d="M8 5v14l11-7z"></path>
  //     <rect class="icon-pause" x="6" y="5" width="4" height="14"></rect>
  //     <rect class="icon-pause" x="14" y="5" width="4" height="14"></rect>
  //   </svg>
  // </button>

  connectedCallback() {
    console.log('connected')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');

    const playPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    playPath.classList.add('icon-play');
    playPath.setAttribute('d', 'M8 5v14l11-7z');

    // const pauseRect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    // pauseRect1.classList.add('icon-pause');
    // pauseRect1.setAttribute('')

    svg.appendChild(playPath);

    this.appendChild(svg);
  }
}
