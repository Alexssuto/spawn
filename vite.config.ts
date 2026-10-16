/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /api/* goes to the FastAPI backend (uv run uvicorn spawn_api.main:app).
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Pure logic runs in Node; files that need a DOM opt in with `// @vitest-environment jsdom`.
    environment: 'node',
  },
})
