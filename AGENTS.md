# Repository guide

dvr-clipper is a browser app for detecting static in MJPEG recordings and exporting clips. The app lives in `packages/web` and uses TypeScript, Vite, native custom elements, and CSS modules.

## Commands and checks

Always run these from the repository root before finishing:

- Format changed files with `yarn workspace @dvr-clipper/web exec prettier --write <file-paths>`. Use absolute file paths so the command finds them from the web workspace.
- Run `yarn typecheck`.

There are no automated tests.

## Working on the code

Paths below are relative to `packages/web/src`.

- Follow the existing custom element and `AppState` event patterns. Register new elements in `ui/register.ts` and keep CSS modules next to their components.
- Sample offsets and sizes are in bytes. Frame times and noise measurement times are in seconds. `encode/mov.ts` converts seconds to the units used by the output video.
- Only MJPEG video is supported, including inside AVI and MOV/MP4 files.
- `encode/mov.ts` uses `mp4box` to copy JPEG frames into the output file. Keep copying frames without re-encoding them unless asked to change this.
- Close `ImageBitmap` objects after use. Keep a limit on how many frames are analyzed, especially for long recordings.
- When changing static detection or clipping, check both `analyze.ts` and `getNoiselessGroupsFromFiles.ts`. Both set a cutoff for what counts as static.
- Use types to catch mistakes while writing code. Keep strict TypeScript checks enabled and fix type errors instead of hiding them with `any` or `@ts-ignore`.
