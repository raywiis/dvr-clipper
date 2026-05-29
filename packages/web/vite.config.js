import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // SharedArrayBuffer (required by ffmpeg.wasm) needs cross-origin isolation
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
