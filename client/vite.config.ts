/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-styled-components'],
      },
    }),
  ],
  server: {
    port: parseInt(process.env.PORT || '3000'),
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@mantine/core') || id.includes('@mantine/hooks')) {
            return 'mantine';
          }

          if (id.includes('cytoscape-klay')) {
            return 'graph-layout';
          }

          if (id.includes('cytoscape-popper') || id.includes('@popperjs/core')) {
            return 'graph-popper';
          }

          if (
            id.includes('cytoscape')
            || id.includes('react-cytoscapejs')
          ) {
            return 'graph-core';
          }

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  define: {
    'process.env.PUBLIC_URL': JSON.stringify(process.env.PUBLIC_URL || ''),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    alias: {
      'glpk.js': 'glpk.js/node',
    },
  },
});
