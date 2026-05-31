import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    allowedHosts: 'all',
  },
  test: {
    // Ambiente de testes que simula o browser (DOM)
    environment: 'jsdom',
    // Carrega os matchers do jest-dom (@testing-library/jest-dom)
    setupFiles: ['./src/tests/setup.js'],
    // Cobertura de código
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/utils/**', 'src/components/**'],
      exclude: ['src/tests/**', 'src/firebase.js', 'src/main.jsx'],
    },
    // Suporte a globals (describe, it, expect sem importar)
    globals: true,
  },
});
