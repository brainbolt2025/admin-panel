import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
function privacyPolicyRewrite() {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const path = req.url?.split('?')[0]
    if (path === '/privacy' || path === '/privacy-policy') {
      req.url = '/privacy-policy.html'
    }
    next()
  }
  return {
    name: 'privacy-policy-rewrite',
    configureServer(server: { middlewares: { use: (fn: typeof rewrite) => void } }) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server: { middlewares: { use: (fn: typeof rewrite) => void } }) {
      server.middlewares.use(rewrite)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), privacyPolicyRewrite()],
  server: {
    // Bind to all interfaces so `localhost` works whether the browser
    // resolves it to IPv4 (127.0.0.1) or IPv6 (::1). Node 17+ resolves
    // `localhost` to ::1 by default, which otherwise leaves 127.0.0.1
    // unreachable and makes the browser time out.
    host: true,
    port: 5173,
  },
})
