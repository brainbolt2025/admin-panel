/**
 * Ping IndexNow after publish.
 * Runs automatically on Vercel production builds, or with INDEXNOW_PING=1.
 */
import { INDEXNOW_KEY, SEO_PAGES, SITE_ORIGIN } from './seo-pages.mjs'

const shouldPing =
  process.env.INDEXNOW_PING === '1' ||
  process.env.VERCEL_ENV === 'production' ||
  process.argv.includes('--force')

if (!shouldPing) {
  console.log('IndexNow: skip (set INDEXNOW_PING=1 or deploy to Vercel production)')
  process.exit(0)
}

const host = new URL(SITE_ORIGIN).host
const urlList = SEO_PAGES.map((page) =>
  page.path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${page.path}`,
)

const payload = {
  host,
  key: INDEXNOW_KEY,
  keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
  urlList,
}

try {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })
  const text = await res.text().catch(() => '')
  if (res.ok || res.status === 202) {
    console.log(`IndexNow: ${res.status} — submitted ${urlList.length} URLs`)
  } else {
    console.warn(`IndexNow: ${res.status} ${text || res.statusText}`)
  }
} catch (err) {
  console.warn('IndexNow: request failed (non-fatal)', err instanceof Error ? err.message : err)
}
