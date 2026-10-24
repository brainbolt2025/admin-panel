import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardList,
  Lock,
  Mail,
  Menu,
  MessageCircle,
  Play,
  RefreshCw,
  X,
} from 'lucide-react'
import AsineLogo from './AsineLogo'
import logoFinal from '../assets/Logo-Final.png'
import { config } from '../config'

interface GuestLandingProps {
  onGetStarted: () => void
  onSignIn: () => void
}

const UNIT_RANGES = ['1 - 50 units', '51 - 200 units', '201 - 1,000 units', '1,000+ units']

const VIMEO_VIDEO_ID = '1225117948'
const VIMEO_TITLE = 'Asine - Manage less. Resolve more.'
const VIMEO_POSTER =
  'https://i.vimeocdn.com/video/2198754137-38aa9742a3330377483d99b35d6d5907b641698213b527b071c2e124cfc43a2e-d_1280x720?region=us'

const PLAN_FEATURES = [
  'Unlimited units',
  'Unlimited tenants and technicians',
  'Work orders with photo attachments',
  'Direct tenant and technician chat',
  'Tenants reopen the same work order',
  'Cancel anytime',
]

const PATH_SECTIONS: Record<string, string> = {
  '/pricing': 'pricing',
  '/features': 'highlights',
  '/contact': 'contact',
}

const highlights = [
  {
    title: 'Reopen Work Orders',
    body: 'Recurring problem? Tenants reopen the same request, with its photos and chat history, instead of starting over.',
    icon: RefreshCw,
    terracotta: true,
  },
  {
    title: 'Work Orders',
    body: 'Tenants submit maintenance requests directly with photo attachments.',
    icon: ClipboardList,
    terracotta: false,
  },
  {
    title: 'Direct Communication',
    body: 'Tenants and assigned technicians communicate in one direct chat channel.',
    icon: MessageCircle,
    terracotta: false,
  },
  {
    title: 'Simple Technician Workflow',
    body: 'Technicians manage assigned jobs, update status, and mark them complete instantly.',
    icon: CalendarCheck,
    terracotta: false,
  },
]

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const GuestLanding = ({ onGetStarted, onSignIn }: GuestLandingProps) => {
  const [email, setEmail] = useState('')
  const [propertyName, setPropertyName] = useState('')
  const [unitRange, setUnitRange] = useState(UNIT_RANGES[0])
  const [sending, setSending] = useState(false)
  const [contactSent, setContactSent] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const section = PATH_SECTIONS[window.location.pathname.replace(/\/$/, '')]
    if (section) scrollToId(section)
  }, [])

  const goToSection = (id: string) => {
    setMobileNavOpen(false)
    scrollToId(id)
  }

  const handleWaitlist = async (e: FormEvent) => {
    e.preventDefault()
    setContactError(null)
    setSending(true)
    try {
      const response = await fetch(config.api.addToWaitlist, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.supabase.anonKey}`,
          apikey: config.supabase.anonKey,
        },
        body: JSON.stringify({
          email: email.trim(),
          property_name: `${propertyName.trim()} · ${unitRange}`,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        message?: string
      }
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.message || 'Could not send your request.')
      }
      setEmail('')
      setPropertyName('')
      setUnitRange(UNIT_RANGES[0])
      setContactSent(true)
    } catch (err) {
      setContactError(
        err instanceof Error ? err.message : 'Could not send your request. Please try again.',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-asine-map flex min-h-screen flex-col text-slate-800">
      <header className="sticky top-0 z-40 border-b border-[#2c6e59]/40 bg-[#143d32] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-white px-2 py-1">
              <AsineLogo size="sm" src={logoFinal} blendOnWhite className="[&_img]:!h-8" />
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-emerald-100/90 md:flex">
            <button type="button" onClick={() => scrollToId('highlights')} className="hover:text-white">
              Platform Highlights
            </button>
            <button type="button" onClick={() => scrollToId('action')} className="hover:text-white">
              How It Works
            </button>
            <button type="button" onClick={() => scrollToId('pricing')} className="hover:text-white">
              Pricing
            </button>
            <button type="button" onClick={() => scrollToId('contact')} className="hover:text-white">
              Contact
            </button>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onSignIn}
              className="hidden min-h-11 rounded-full border border-[#38826b]/50 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:border-[#52b788] hover:text-white sm:inline-flex sm:items-center sm:text-sm"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={onGetStarted}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-[#52b788] px-4 py-2 text-xs font-semibold text-[#0d2b23] shadow-md transition hover:bg-[#74c69d] sm:text-sm"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#38826b]/50 text-emerald-100 transition hover:border-[#52b788] hover:text-white md:hidden"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav className="border-t border-[#2c6e59]/40 px-4 py-3 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              <button
                type="button"
                onClick={() => goToSection('highlights')}
                className="min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium text-emerald-100 hover:bg-[#1b4d3e] hover:text-white"
              >
                Platform Highlights
              </button>
              <button
                type="button"
                onClick={() => goToSection('action')}
                className="min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium text-emerald-100 hover:bg-[#1b4d3e] hover:text-white"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => goToSection('pricing')}
                className="min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium text-emerald-100 hover:bg-[#1b4d3e] hover:text-white"
              >
                Pricing
              </button>
              <button
                type="button"
                onClick={() => goToSection('contact')}
                className="min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium text-emerald-100 hover:bg-[#1b4d3e] hover:text-white"
              >
                Contact
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false)
                  onSignIn()
                }}
                className="min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium text-emerald-100 hover:bg-[#1b4d3e] hover:text-white sm:hidden"
              >
                Sign in
              </button>
            </div>
          </nav>
        )}
      </header>

      <section className="bg-asine-hero-map relative overflow-hidden border-b border-[#2c6e59]/40 px-4 pb-16 pt-12 text-white sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -bottom-10 -left-12 opacity-20">
          <svg width="240" height="240" viewBox="0 0 200 200" fill="#34d399">
            <path d="M40,180 Q80,40 180,20 Q120,160 40,180 Z" />
          </svg>
        </div>
        <div className="relative z-10 mx-auto max-w-5xl space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#52b788]/30 bg-[#1b4d3e]/80 px-3.5 py-1.5 text-xs font-medium tracking-wide text-emerald-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            For residential property managers
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            When a Repair Comes Back, <br className="hidden sm:inline" /> Pick Up Where You Left Off
          </h1>
          <p className="mx-auto max-w-3xl text-base font-normal leading-relaxed text-emerald-100/90 sm:text-lg">
            Stop being the middleman between group texts, calls, and emails. Asine keeps the tenant,
            photos, and technician chat on one work order. If the problem returns, the tenant
            reopens that same request instead of starting over.
          </p>
          <div className="pt-6">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-[#38826b]/40 bg-[#143d32]/90 p-5 shadow-2xl backdrop-blur-md sm:p-6">
              <button
                type="button"
                onClick={onGetStarted}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#52b788] px-6 py-3 text-sm font-bold text-[#0d2b23] shadow-md transition hover:bg-[#74c69d] sm:text-base"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToId('action')}
                className="text-sm font-semibold text-emerald-200 underline-offset-4 transition hover:text-white hover:underline"
              >
                Watch the 2-minute demo
              </button>
              <p className="text-center text-xs text-emerald-200/90 sm:text-sm">
                Flat $199.99/month · Unlimited units.{' '}
                <button
                  type="button"
                  onClick={() => scrollToId('contact')}
                  className="font-semibold text-emerald-100 underline hover:text-white"
                >
                  Ask us for a 30-day free trial code
                </button>
                . Pay nothing for the first 30 days. Cancel before then and you are never charged.
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-2">
          <section
            id="highlights"
            className="scroll-mt-24 flex flex-col justify-between rounded-3xl border border-[#2c6e59] bg-[#1b4d3e] p-6 text-white shadow-xl sm:p-8"
          >
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Asine Platform Highlights</h2>
              <p className="mb-6 mt-2 text-xs text-emerald-100/80 sm:text-sm">
                Designed specifically to eliminate middleman overhead for property managers.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {highlights.map(({ title, body, icon: Icon, terracotta }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => scrollToId('action')}
                    className={`group rounded-2xl border bg-white p-4 text-left text-slate-800 shadow-sm transition hover:shadow-md ${
                      terracotta
                        ? 'border-slate-100 hover:border-[#c25e38]'
                        : 'border-slate-100 hover:border-[#52b788]'
                    }`}
                  >
                    <div
                      className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition group-hover:scale-110 ${
                        terracotta ? 'bg-orange-50 text-[#c25e38]' : 'bg-emerald-50 text-[#1b4d3e]'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-1 text-sm font-bold text-slate-900">{title}</h3>
                    <p className="text-xs leading-relaxed text-slate-600">{body}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section
            id="action"
            className="scroll-mt-24 flex flex-col justify-between rounded-3xl border border-[#2c6e59] bg-[#143d32] p-6 text-white shadow-xl sm:p-8"
          >
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">See Asine in Action</h2>
                <p className="mt-1 text-xs text-emerald-200/80 sm:text-sm">
                  Watch how tenants, technicians, and property managers work together.
                </p>
              </div>
              <PromoVideo />
            </div>
            <p className="mt-4 text-center text-xs font-medium text-emerald-200">
              {VIMEO_TITLE}
            </p>
          </section>
        </div>

        <section
          id="pricing"
          className="scroll-mt-24 rounded-3xl border border-[#2c6e59] bg-[#1b4d3e] p-6 text-white shadow-xl sm:p-10"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              One flat price. No per-unit fees.
            </h2>
            <p className="mt-2 text-sm text-emerald-100/80">
              Every plan includes unlimited units, tenants, and technicians.
            </p>
          </div>
          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
            <PriceCard
              name="Monthly"
              price="$199.99"
              period="/month"
              valueAnchor="At $2.00/unit, 100 units would cost $200/month elsewhere. Here it is $199.99 total, however much you grow."
              onGetStarted={onGetStarted}
            />
            <PriceCard
              name="Yearly"
              price="$1,919.99"
              period="/year"
              note="Save 20% · $479.89 less than paying monthly"
              badge="Recommended"
              highlighted
              onGetStarted={onGetStarted}
            />
          </div>
          <p className="mt-8 text-center text-xs text-emerald-100/80 sm:text-sm">
            Have a trial code from us? Enter it at checkout. Pay nothing for the first 30 days.
            Cancel before then and you are never charged.{' '}
            <button
              type="button"
              onClick={() => scrollToId('contact')}
              className="font-semibold text-emerald-100 underline hover:text-white"
            >
              Ask for a 30-day free trial code
            </button>
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-200/70">
            <Lock className="h-3.5 w-3.5" />
            Payments are processed securely by Stripe.
          </p>
        </section>

        <section
          id="contact"
          className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-10"
        >
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d8f3dc] bg-[#f0fdf4] text-[#1b4d3e]">
                <Mail className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Contact us
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Want to try Asine first? Tell us about your portfolio and we will send you a code
                for a 30-day free trial. Pay nothing for the first 30 days. Cancel before then and
                you are never charged. Ready to go live right now? Get started and activate a plan
                instead.
              </p>
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1b4d3e] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#143d32]"
              >
                Get Started Now
                <ArrowRight className="h-4 w-4 text-emerald-300" />
              </button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 lg:col-span-7 sm:p-8">
              {contactSent ? (
                <div className="space-y-3 py-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-[#1b4d3e]">
                    <Check className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Message sent</h3>
                  <p className="text-xs text-slate-600">
                    Thanks for reaching out. We will contact you shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleWaitlist} className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Work email
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@property.com"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-[#2c6e59]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Property or company name
                    </span>
                    <input
                      type="text"
                      required
                      value={propertyName}
                      onChange={(e) => setPropertyName(e.target.value)}
                      placeholder="Apex Property Management"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-[#2c6e59]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      How many units do you manage?
                    </span>
                    <select
                      value={unitRange}
                      onChange={(e) => setUnitRange(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-[#2c6e59]"
                    >
                      {UNIT_RANGES.map((range) => (
                        <option key={range} value={range}>
                          {range}
                        </option>
                      ))}
                    </select>
                  </label>
                  {contactError && <p className="text-sm text-red-600">{contactError}</p>}
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2c6e59] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#1b4d3e] disabled:opacity-60"
                  >
                    {sending ? 'Sending…' : 'Send message'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#143d32] bg-[#0d2b23] px-4 py-8 text-center text-xs text-emerald-100/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p>
            <span className="font-bold text-white">Syc&amp;More LLC</span>
            <span className="ml-2">
              Florida · © {new Date().getFullYear()} Syc&amp;More LLC. All rights reserved.
            </span>
          </p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="underline hover:text-white">
              Privacy policy
            </a>
            <button type="button" onClick={() => scrollToId('contact')} className="underline hover:text-white">
              Support
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

function PriceCard({
  name,
  price,
  period,
  note,
  valueAnchor,
  badge,
  highlighted = false,
  onGetStarted,
}: {
  name: string
  price: string
  period: string
  note?: string
  valueAnchor?: string
  badge?: string
  highlighted?: boolean
  onGetStarted: () => void
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-6 text-slate-800 shadow-sm ${
        highlighted ? 'border-[#52b788] ring-2 ring-[#52b788]' : 'border-slate-100'
      }`}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#52b788] px-3 py-1 text-xs font-bold text-[#0d2b23]">
          {badge}
        </span>
      )}
      <h3 className="text-sm font-bold uppercase tracking-wider text-[#1b4d3e]">{name}</h3>
      <p className="mt-3">
        <span className="text-4xl font-extrabold text-slate-900">{price}</span>
        <span className="text-sm text-slate-500">{period}</span>
      </p>
      {note && <p className="mt-1 text-xs font-semibold text-[#2c6e59]">{note}</p>}
      {valueAnchor && <p className="mt-2 text-xs leading-relaxed text-slate-600">{valueAnchor}</p>}
      <ul className="mt-5 flex-1 space-y-2">
        {PLAN_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2c6e59]" />
            {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onGetStarted}
        className={`mt-6 flex min-h-11 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-md transition ${
          highlighted
            ? 'bg-[#2c6e59] text-white hover:bg-[#1b4d3e]'
            : 'border border-[#2c6e59] text-[#1b4d3e] hover:bg-[#f0fdf4]'
        }`}
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function PromoVideo() {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-[#38826b]/30 bg-[#0d2b23] shadow-inner">
      {playing ? (
        <iframe
          src={`https://player.vimeo.com/video/${VIMEO_VIDEO_ID}?badge=0&autopause=0&autoplay=1&dnt=1`}
          title={VIMEO_TITLE}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0"
          aria-label={`Play ${VIMEO_TITLE}`}
        >
          <img
            src={VIMEO_POSTER}
            alt="Asine work order demo video preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-[#0d2b23]/30 transition group-hover:bg-[#0d2b23]/15" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#52b788] text-[#0d2b23] shadow-lg transition group-hover:scale-110">
              <Play className="ml-0.5 h-7 w-7 fill-current" />
            </span>
          </span>
        </button>
      )}
    </div>
  )
}

export default GuestLanding
