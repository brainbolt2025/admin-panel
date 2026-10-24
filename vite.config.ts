import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

const MARKETING_REWRITES: Record<string, string> = {
  '/privacy': '/privacy-policy.html',
  '/privacy-policy': '/privacy-policy.html',
  '/pricing': '/pricing.html',
  '/about': '/about.html',
  '/features': '/features.html',
}

function marketingPageRewrite() {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (!req.url) {
      next()
      return
    }
    const [pathname, search = ''] = req.url.split('?')
    const dest = MARKETING_REWRITES[pathname]
    if (dest) {
      req.url = search ? `${dest}?${search}` : dest
    }
    next()
  }
  return {
    name: 'marketing-page-rewrite',
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
  plugins: [react(), marketingPageRewrite()],
  server: {
    // Bind to all interfaces so `localhost` works whether the browser
    // resolves it to IPv4 (127.0.0.1) or IPv6 (::1). Node 17+ resolves
    // `localhost` to ::1 by default, which otherwise leaves 127.0.0.1
    // unreachable and makes the browser time out.
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        pricing: resolve(rootDir, 'pricing.html'),
        about: resolve(rootDir, 'about.html'),
        features: resolve(rootDir, 'features.html'),
      },
    },
  },
})
