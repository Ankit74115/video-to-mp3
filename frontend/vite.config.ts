import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Third arg '' loads every key (not just VITE_*) into this Node-side object.
  // Only VITE_* keys are ever exposed to the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const gateway = env.GATEWAY_URL || 'http://localhost:8080'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': {
          target: gateway,
          changeOrigin: true,
          // The gateway serves routes at root (/login, not /api/login).
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
  }
})
