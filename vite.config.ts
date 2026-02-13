import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  },
  // Load env from parent directory
  envDir: path.resolve(__dirname, '..')
})