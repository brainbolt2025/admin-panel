/**
 * Local preview of the shared Asine email layout (no deploy required).
 *
 * Usage (from repo root):
 *   npm run email:preview
 *
 * Then open email-preview.html in your browser.
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Polyfill Deno.env so we can import the Edge Function shared module under Node.
const envStore: Record<string, string> = { ...process.env } as Record<string, string>
;(globalThis as unknown as { Deno: unknown }).Deno = {
  env: {
    get: (key: string) => envStore[key],
    set: (key: string, value: string) => {
      envStore[key] = value
    },
  },
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
envStore.EMAIL_LOGO_URL = './public/Logo-Final.png'

const { asineEmailHtml } = await import('../supabase/functions/_shared/asineEmailLayout.ts')

const html = asineEmailHtml({
  title: 'Confirm your new email',
  greeting: 'Hi Juan,',
  paragraphs: [
    'You requested to change your Asine Property Manager email to <strong>you@example.com</strong>.',
    'Click the button below to confirm. Your login email will only change after you confirm.',
  ],
  cta: { label: 'Confirm new email', href: '#' },
  noticeHtml:
    'This link expires in 24 hours. If you did not request this change, you can ignore this email.',
  signOff: null,
  fallbackLink: 'https://example.com/confirm?token=preview',
})

const outPath = join(root, 'email-preview.html')
writeFileSync(outPath, html, 'utf8')
console.log(`Wrote ${outPath}`)
console.log('Open email-preview.html in your browser to preview the layout.')
