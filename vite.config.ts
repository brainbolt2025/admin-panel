import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, PreviewServer, ViteDevServer } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

const MARKETING_REWRITES: Record<string, string> = {
  '/privacy': '/privacy-policy.html',
  '/privacy-policy': '/privacy-policy.html',
  '/pricing': '/pricing.html',
  '/about': '/about.html',
  '/features': '/features.html',
  '/vs/asine-vs-property-meld': '/vs/asine-vs-property-meld.html',
  '/vs/asine-vs-buildium': '/vs/asine-vs-buildium.html',
}

/** Client routes that must load the React app shell (not marketing HTML). */
const SPA_SHELL_PATHS = new Set(['/login', '/subscribe', '/reset-password'])

function isViteInternal(pathname: string) {
  return (
    pathname.startsWith('/@') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    pathname.startsWith('/assets/')
  )
}

function wantsHtml(req: Connect.IncomingMessage) {
  const accept = req.headers.accept || ''
  return accept.includes('text/html')
}

function rewriteKnownPaths(): Connect.NextHandleFunction {
  return (req, _res, next) => {
    if (!req.url) {
      next()
      return
    }
    const [pathname, search = ''] = req.url.split('?')
    if (isViteInternal(pathname)) {
      next()
      return
    }
    const marketing = MARKETING_REWRITES[pathname]
    if (marketing) {
      req.url = search ? `${marketing}?${search}` : marketing
      next()
      return
    }
    if (SPA_SHELL_PATHS.has(pathname)) {
      req.url = search ? `/index.html?${search}` : '/index.html'
      next()
      return
    }
    next()
  }
}

function serveNotFoundHtml(serverRoot: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (res.headersSent || !req.url || !wantsHtml(req)) {
      next()
      return
    }
    const pathname = req.url.split('?')[0]
    if (isViteInternal(pathname) || pathname.includes('.')) {
      next()
      return
    }
    try {
      const html = readFileSync(resolve(serverRoot, '404.html'), 'utf8')
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(html)
    } catch {
      res.statusCode = 404
      res.end('Not Found')
    }
  }
}

function marketingSpaAnd404() {
  return {
    name: 'marketing-spa-and-404',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(rewriteKnownPaths())
      return () => {
        server.middlewares.use(serveNotFoundHtml(rootDir + '/public'))
      }
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(rewriteKnownPaths())
      return () => {
        server.middlewares.use(serveNotFoundHtml(resolve(rootDir, 'dist')))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Avoid SPA fallback (200 + index.html) for unknown paths — matches Vercel 404 behavior.
  appType: 'mpa',
  plugins: [react(), marketingSpaAnd404()],
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
        vsPropertyMeld: resolve(rootDir, 'vs/asine-vs-property-meld.html'),
        vsBuildium: resolve(rootDir, 'vs/asine-vs-buildium.html'),
      },
    },
  },
})
