/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Pure logic runs in Node; files that need a DOM opt in with `// @vitest-environment jsdom`.
    environment: 'node',
  },
})
