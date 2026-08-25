import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardList,
  Headphones,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  Play,
  RefreshCw,
  Settings2,
  Workflow,
} from 'lucide-react'
import AsineLogo from './AsineLogo'
import logoFinal from '../assets/Logo-Final.png'
import { config } from '../config'

interface GuestLandingProps {
  onGetStarted: () => void
  onSignIn: () => void
}

const UNIT_RANGES = ['1 - 50 units', '51 - 200 units', '201 - 1,000 units', '1,000+ units']

const highlights = [
  {
    step: 1,
    title: 'Work Orders',
    body: 'Tenants submit maintenance requests directly with photo attachments.',
    icon: ClipboardList,
    terracotta: false,
  },
  {
    step: 3,
    title: 'Direct Communication',
    body: 'Tenants and assigned technicians communicate in one direct chat channel.',
    icon: MessageCircle,
    terracotta: false,
  },
  {
    step: 4,
    title: 'Reopen Work Orders',
    body: 'Recurring problem? Tenants can reopen existing requests without starting over.',
    icon: RefreshCw,
    terracotta: true,
  },
  {
    step: 2,
    title: 'Simple Technician Workflow',
    body: 'Technicians manage assigned jobs, update status, and mark them complete instantly.',
    icon: CalendarCheck,
    terracotta: false,
  },
]

const stepTiles = [
  { step: 1, title: 'Tenant Request', caption: 'Submit issue' },
  { step: 2, title: 'Tech Assigned', caption: 'PM assigns job' },
  { step: 3, title: 'Direct Chat', caption: 'Tenant & Tech' },
  { step: 4, title: 'Complete/Reopen', caption: 'Resolution' },
]

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const GuestLanding = ({ onGetStarted, onSignIn }: GuestLandingProps) => {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [propertyName, setPropertyName] = useState('')
  const [unitRange, setUnitRange] = useState(UNIT_RANGES[0])
  const [sending, setSending] = useState(false)
  const [contactSent, setContactSent] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const playTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (playTimer.current) window.clearInterval(playTimer.current)
    }
  }, [])

  const simulateFlow = () => {
    if (playTimer.current) window.clearInterval(playTimer.current)
    let next = 1
    setStep(1)
    playTimer.current = window.setInterval(() => {
      next += 1
      setStep(next)
      if (next >= 4 && playTimer.current) {
        window.clearInterval(playTimer.current)
        playTimer.current = null
      }
    }, 2500)
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

  const active = workflowSteps[step - 1]

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
            <button type="button" onClick={() => scrollToId('contact')} className="hover:text-white">
              Contact
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full border border-[#38826b]/50 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:border-[#52b788] hover:text-white sm:text-sm"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={onGetStarted}
              className="flex items-center gap-1.5 rounded-full bg-[#52b788] px-4 py-2 text-xs font-semibold text-[#0d2b23] shadow-md transition hover:bg-[#74c69d] sm:text-sm"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
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
            The Modern Property Maintenance Ecosystem
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Spend Less Time Managing <br className="hidden sm:inline" /> Maintenance Communication
          </h1>
          <p className="mx-auto max-w-3xl text-base font-normal leading-relaxed text-emerald-100/90 sm:text-lg">
            Asine connects tenants and technicians directly around work orders, so property managers
            can focus on managing their properties instead of middle-manning every ticket.
          </p>
          <div className="pt-6">
            <div className="mx-auto max-w-4xl rounded-2xl border border-[#38826b]/40 bg-[#143d32]/90 p-4 shadow-2xl backdrop-blur-md sm:p-5">
              <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-emerald-300">
                Get Started with Asine
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <HeroAction icon={ArrowRight} label="Get Started" onClick={onGetStarted} />
                <HeroAction
                  icon={Workflow}
                  label="See How It Works"
                  onClick={() => scrollToId('action')}
                />
                <HeroAction
                  icon={Settings2}
                  label="Explore Features"
                  onClick={() => scrollToId('highlights')}
                />
                <HeroAction
                  icon={Headphones}
                  label="Contact Us"
                  onClick={() => scrollToId('contact')}
                />
              </div>
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
                {highlights.map(({ step: highlightStep, title, body, icon: Icon, terracotta }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => setStep(highlightStep)}
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
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight sm:text-2xl">See Asine in Action</h2>
                  <p className="text-xs text-emerald-200/80 sm:text-sm">
                    Click any step to inspect the live interaction workflow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={simulateFlow}
                  className="flex items-center gap-1 rounded-lg border border-[#38826b]/40 bg-[#1b4d3e] px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-[#2c6e59]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Simulate Flow
                </button>
              </div>
              <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {stepTiles.map((tile) => {
                  const activeTile = tile.step === step
                  return (
                    <button
                      key={tile.step}
                      type="button"
                      onClick={() => setStep(tile.step)}
                      className={`flex flex-col items-center rounded-xl p-3 text-center transition ${
                        activeTile
                          ? 'border-2 border-emerald-400 bg-[#1b4d3e] shadow-md'
                          : 'border border-[#2c6e59] bg-[#1b4d3e]/60 hover:bg-[#1b4d3e]'
                      }`}
                    >
                      <span
                        className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          activeTile ? 'bg-emerald-400 text-[#0d2b23]' : 'bg-[#2c6e59] text-white'
                        }`}
                      >
                        {tile.step}
                      </span>
                      <span className="text-[11px] font-bold leading-tight">{tile.title}</span>
                      <span className="text-[9px] text-emerald-300">{tile.caption}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex min-h-[220px] flex-col justify-between rounded-2xl border border-[#38826b]/30 bg-white p-4 text-slate-800 shadow-inner sm:p-5">
                {active.content}
              </div>
            </div>
            <p className="mt-4 text-center text-xs font-medium text-emerald-200">{active.caption}</p>
          </section>
        </div>

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
                Tell us about your property portfolio and we will follow up. Ready to go live right
                now? Get started and activate a plan instead.
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
                      placeholder="Sunset Apartments / Apex Management"
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
            <span className="font-bold text-white">Asine</span>
            <span className="ml-2">© {new Date().getFullYear()} Asine. All rights reserved.</span>
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

function HeroAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ArrowRight
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-center gap-2 rounded-xl border border-[#52b788]/40 bg-[#1b4d3e] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#2c6e59] sm:text-sm"
    >
      <Icon className="h-4 w-4 text-emerald-300 transition group-hover:scale-110" />
      {label}
    </button>
  )
}

const workflowSteps: { caption: string; content: ReactNode }[] = [
  {
    caption: 'Step 1 of 4: Tenant submits work order directly.',
    content: (
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            New Work Order
          </span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            Pending
          </span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="text-xs font-bold text-slate-900">Leaking faucet — Unit 12B</div>
          <div className="text-[11px] text-slate-500">
            Submitted by Sarah Jenkins · Kitchen sink leaking water onto floor.
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
          <ImageIcon className="h-3 w-3 text-[#2c6e59]" />1 Photo Attached
        </span>
      </div>
    ),
  },
  {
    caption: 'Step 2 of 4: Property manager assigns a technician.',
    content: (
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Technician Assigned
          </span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
            Assigned
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1b4d3e] text-xs font-bold text-white">
            JT
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">John Technician</div>
            <div className="text-[10px] font-medium text-[#1b4d3e]">Plumbing · ETA 2:15 PM</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    caption: 'Step 3 of 4: Tenant and technician communicate in-app.',
    content: (
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Direct Communication
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            Live Chat
          </span>
        </div>
        <div className="max-w-[85%] rounded-lg bg-slate-100 p-2 text-[11px] text-slate-800">
          <span className="block text-[9px] font-semibold text-slate-500">John Tech</span>
          Hi Sarah, I see your photo of the leak. On my way with replacement washers!
        </div>
        <div className="ml-auto max-w-[85%] rounded-lg bg-[#1b4d3e] p-2 text-[11px] text-white">
          <span className="block text-[9px] font-semibold text-emerald-200">Sarah (Tenant)</span>
          Great, thanks! Gate code is #4921.
        </div>
      </div>
    ),
  },
  {
    caption: 'Step 4 of 4: Completed, or reopened if the issue comes back.',
    content: (
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Job Status</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            Completed
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-900">Work Order Resolved</span>
          </div>
          <span className="text-[10px] text-slate-500">2:45 PM</span>
        </div>
        <div className="flex justify-end pt-1">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#c25e38] px-3 py-1.5 text-xs font-bold text-white">
            <RefreshCw className="h-3.5 w-3.5" />
            Reopen Issue
          </span>
        </div>
      </div>
    ),
  },
]

export default GuestLanding
