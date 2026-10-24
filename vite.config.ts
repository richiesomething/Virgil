import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Each book's data is its own lazily loaded chunk; Monte Cristo's is large by nature.
  build: { chunkSizeWarningLimit: 900 },
})
