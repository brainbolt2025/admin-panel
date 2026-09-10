/**
 * Shared Asine branded HTML email shell.
 * Logo: public/asine-wordmark.png (same file as the landing page header).
 */

const HEADER_BG = '#0d2b23'
const HEADER_BG_LIGHT = '#1b4d3e'
const BRAND_GREEN = '#1a3c34'
const TAGLINE_TEAL = '#74c69d'
const LINK_TEAL = '#0f766e'
const TEXT = '#334155'
const HEADING = '#0d2b23'
const MUTED = '#64748b'
const FOOTER_BG = '#f8fafc'
const FOOTER_BORDER = '#e2e8f0'
const FOOTER_TEXT = '#64748b'
const FOOTER_SUBTEXT = '#94a3b8'
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
    const httpsOrigin = origin.replace(/^http:\/\//i, 'https://')
    return `${httpsOrigin}/asine-wordmark.png`
  }

  return `${DEFAULT_PUBLIC_ORIGIN}/asine-wordmark.png`
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
  /** Small line under the footer copyright, e.g. why they received this email */
  footerNote?: string
}

export function asineEmailHtml(opts: AsineEmailOptions): string {
  const logoUrl = getAsineLogoUrl()

  const paragraphs = (opts.paragraphs || [])
    .map((p) => `<p style="margin:0 0 16px 0;color:${TEXT};font-size:15px;line-height:1.6;">${p}</p>`)
    .join('')

  const greeting = opts.greeting
    ? `<p style="margin:0 0 16px 0;color:${TEXT};font-size:15px;line-height:1.6;">${opts.greeting}</p>`
    : ''

  const cta = opts.cta
    ? `<table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0;">
        <tr>
          <td align="center">
            <a href="${opts.cta.href}" target="_blank"
              style="display:inline-block;background-color:${BRAND_GREEN};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;">
              ${opts.cta.label}
            </a>
          </td>
        </tr>
      </table>`
    : ''

  const notice = opts.noticeHtml
    ? `<p style="margin:24px 0 0 0;color:${MUTED};font-size:13px;line-height:1.5;">${opts.noticeHtml}</p>`
    : ''

  const secondary = opts.secondaryNote
    ? `<p style="margin:12px 0 0 0;color:${MUTED};font-size:13px;line-height:1.5;">${opts.secondaryNote}</p>`
    : ''

  const signOff =
    opts.signOff === null
      ? ''
      : `<p style="margin:24px 0 0 0;color:${TEXT};font-size:14px;line-height:1.5;">${
          opts.signOff ?? `Best regards,<br/><strong style="color:${HEADING};">The Asine Team</strong>`
        }</p>`

  const fallback = opts.fallbackLink
    ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">
       <p style="margin:0;color:${FOOTER_SUBTEXT};font-size:12px;line-height:1.5;">
         ${opts.fallbackLinkLabel || "If the button doesn't work, copy and paste this link into your browser:"}<br>
         <a href="${opts.fallbackLink}" style="color:${LINK_TEAL};word-break:break-all;">${opts.fallbackLink}</a>
       </p>`
    : ''

  const footerNote = opts.footerNote
    ? `<p style="margin:0;font-size:11px;color:${FOOTER_SUBTEXT};">${opts.footerNote}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e2e8f0;">
    <tr>
      <td align="center" style="padding:20px 16px 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:18px;overflow:hidden;">

          <!-- HEADER: dark gradient + pill logo badge -->
          <tr>
            <td align="center"
              bgcolor="${HEADER_BG}"
              style="background-color:${HEADER_BG};background-image:radial-gradient(circle at 50% 30%, ${HEADER_BG_LIGHT}, ${HEADER_BG});padding:36px 30px;">
              <!--[if gte mso 9]>
              <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:150px;">
                <v:fill type="tile" color="${HEADER_BG}" />
                <v:textbox inset="0,0,0,0">
              <![endif]-->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#ffffff;padding:10px 22px;border-radius:30px;">
                    <img src="${logoUrl}" alt="Asine" width="140" style="display:block;width:140px;height:auto;border:0;" />
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0 0;color:${TAGLINE_TEAL};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">
                Property Maintenance Ecosystem
              </p>
              <!--[if gte mso 9]>
                </v:textbox>
              </v:rect>
              <![endif]-->
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 32px 28px 32px;background-color:#ffffff;">
              <h1 style="margin:0 0 16px 0;color:${HEADING};font-size:24px;font-weight:800;line-height:1.25;">
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

          <!-- FOOTER -->
          <tr>
            <td style="background-color:${FOOTER_BG};padding:24px 32px;border-top:1px solid ${FOOTER_BORDER};text-align:center;">
              <p style="margin:0 0 8px 0;font-size:12px;color:${FOOTER_TEXT};">
                &copy; ${new Date().getFullYear()} Asine. All rights reserved. &bull; Property Maintenance Platform
              </p>
              ${footerNote}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
