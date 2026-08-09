/**
 * Shared Asine branded HTML email shell.
 * Logo: public/asine-logo.jpg via EMAIL_LOGO_URL or a public SITE_URL host.
 * (UI uses asine-logo.png; emails use the JPG for better client rendering.)
 */

const BRAND_GREEN = '#1a3c34'
const LINK_TEAL = '#0f766e'
const TEXT = '#1f2933'
const MUTED = '#666666'
const FOOTER = '#999999'
const DEFAULT_PUBLIC_ORIGIN = 'https://www.sycnmore.com'

function isPublicHttpOrigin(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false
    return true
  } catch {
    return false
  }
}

export function getAsineLogoUrl(): string {
  const explicit = Deno.env.get('EMAIL_LOGO_URL')
  if (explicit) return explicit

  const candidates = [
    Deno.env.get('SITE_URL'),
    Deno.env.get('APP_URL'),
    Deno.env.get('BASE_URL'),
    DEFAULT_PUBLIC_ORIGIN,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const origin = candidate.replace(/\/$/, '')
    if (!isPublicHttpOrigin(origin)) continue
    // Prefer https for email image loads
    const httpsOrigin = origin.replace(/^http:\/\//i, 'https://')
    return `${httpsOrigin}/asine-logo.jpg`
  }

  return `${DEFAULT_PUBLIC_ORIGIN}/asine-logo.jpg`
}

export interface AsineEmailCta {
  label: string
  href: string
}

export interface AsineEmailOptions {
  /** Main headline inside the white card */
  title: string
  /** e.g. "Hi Juan," — omit to skip */
  greeting?: string
  /** Body paragraphs as HTML fragments (may include <strong>, etc.) */
  paragraphs?: string[]
  /** Optional HTML block inserted after paragraphs (credentials box, quote, etc.) */
  extraHtml?: string
  /** Primary CTA button */
  cta?: AsineEmailCta
  /** e.g. "Important: This link expires in 24 hours." */
  noticeHtml?: string
  /** Secondary note under the notice */
  secondaryNote?: string
  /** Closing line, default: Best regards / The Asine Team — set null to hide */
  signOff?: string | null
  /** If set, adds the copy-paste fallback link footer */
  fallbackLink?: string
  fallbackLinkLabel?: string
}

export function asineEmailHtml(opts: AsineEmailOptions): string {
  const logoUrl = getAsineLogoUrl()
  const paragraphs = (opts.paragraphs || [])
    .map((p) => `<p style="margin:0 0 16px 0;color:${TEXT};font-size:16px;line-height:1.6;">${p}</p>`)
    .join('')

  const greeting = opts.greeting
    ? `<p style="margin:0 0 16px 0;color:${TEXT};font-size:16px;line-height:1.6;">${opts.greeting}</p>`
    : ''

  const cta = opts.cta
    ? `<div style="text-align:center;margin:28px 0;">
        <a href="${opts.cta.href}"
          style="background:${BRAND_GREEN};color:#ffffff;padding:14px 28px;border-radius:9999px;text-decoration:none;display:inline-block;font-weight:bold;font-size:15px;">
          ${opts.cta.label}
        </a>
      </div>`
    : ''

  const notice = opts.noticeHtml
    ? `<p style="margin:24px 0 0 0;color:${MUTED};font-size:14px;line-height:1.5;">${opts.noticeHtml}</p>`
    : ''

  const secondary = opts.secondaryNote
    ? `<p style="margin:12px 0 0 0;color:${MUTED};font-size:14px;line-height:1.5;">${opts.secondaryNote}</p>`
    : ''

  const signOff =
    opts.signOff === null
      ? ''
      : `<p style="margin:28px 0 0 0;color:${TEXT};font-size:15px;line-height:1.6;">${
          opts.signOff ?? 'Best regards,<br/>The Asine Team'
        }</p>`

  const fallback = opts.fallbackLink
    ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">
       <p style="margin:0;color:${FOOTER};font-size:12px;line-height:1.5;">
         ${opts.fallbackLinkLabel || "If the button doesn't work, copy and paste this link into your browser:"}<br>
         <a href="${opts.fallbackLink}" style="color:${LINK_TEAL};word-break:break-all;">${opts.fallbackLink}</a>
       </p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:36px 32px;">
              <div style="margin:0 0 24px 0;">
                <img src="${logoUrl}" alt="Asine" width="160" style="display:block;max-width:160px;height:auto;border:0;" />
              </div>
              <h1 style="margin:0 0 20px 0;color:${BRAND_GREEN};font-size:26px;line-height:1.25;font-weight:bold;">
                ${opts.title}
              </h1>
              ${greeting}
              ${paragraphs}
              ${opts.extraHtml || ''}
              ${cta}
              ${notice}
              ${secondary}
              ${signOff}
              ${fallback}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
