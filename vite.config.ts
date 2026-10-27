import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // set VITE_BASE=/repo-name/ when deploying under a sub-path (e.g. GitHub Pages project sites)
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
})
