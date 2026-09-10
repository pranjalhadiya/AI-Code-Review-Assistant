import { defineConfig } from 'vite'  // Imports Vite's config helper function — gives us autocomplete/type checking for the config object.
import react from '@vitejs/plugin-react'  // Imports the official plugin that lets Vite understand and process React (JSX syntax, fast refresh, etc.).
import tailwindcss from '@tailwindcss/vite'  // Imports the Tailwind plugin we just installed.

export default defineConfig({
  plugins: [
    react(),          // Registers React support so Vite knows how to handle .jsx files.
    tailwindcss(),     // Registers Tailwind so Vite scans our code and injects the generated CSS automatically.
  ],
})