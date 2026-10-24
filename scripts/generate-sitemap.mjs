import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEO_PAGES, SITE_ORIGIN } from './seo-pages.mjs'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

function gitLastmod(sources) {
  let newest = null
  for (const source of sources) {
    try {
      const out = execSync(`git log -1 --format=%cs -- "${source}"`, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(out)) {
        if (!newest || out > newest) newest = out
      }
    } catch {
      // File may be new / untracked
    }
  }
  return newest
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const urls = SEO_PAGES.map((page) => {
  const loc = page.path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${page.path}`
  const lastmod = gitLastmod(page.sources)
  return { loc, lastmod }
})

const body = urls
  .map(({ loc, lastmod }) => {
    const lastmodLine = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodLine}\n  </url>`
  })
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`

const publicDir = join(rootDir, 'public')
mkdirSync(publicDir, { recursive: true })
writeFileSync(join(publicDir, 'sitemap.xml'), xml, 'utf8')

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`

writeFileSync(join(publicDir, 'robots.txt'), robots, 'utf8')

console.log(`Wrote sitemap.xml (${urls.length} URLs) and robots.txt`)
for (const { loc, lastmod } of urls) {
  console.log(`  ${loc}${lastmod ? `  lastmod=${lastmod}` : '  (no git lastmod yet)'}`)
}
