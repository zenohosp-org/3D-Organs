import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5180, open: false },
  // GLB/GLTF binaries are served from /public; keep them out of the JS graph.
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr'],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // three.js is ~600 KB on its own — split it so the app shell paints
        // before the renderer bundle finishes downloading.
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
