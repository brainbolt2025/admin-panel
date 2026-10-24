import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { ArrowRight, Sparkles, Users, X } from 'lucide-react'
import {
  isPmTourSpotlightStep,
  PM_TOUR_TARGETS,
  type PmTourSpotlightStep,
  type PmTourStep,
} from '../lib/pmOnboarding'

type TourCopy = {
  title: string
  body: string
  hint: string
}

const COPY: Record<PmTourSpotlightStep, TourCopy> = {
  'nav-tenants': {
    title: 'Start here: Tenants',
    body: 'Tap Tenants in the sidebar to open your tenant list. That is where you invite people into Asine.',
    hint: 'Click the highlighted Tenants item',
  },
  'add-tenants': {
    title: 'Add tenants',
    body: 'Use this button to invite one tenant or many at once. No invitation emails are sent — you will share a QR instead.',
    hint: 'Click Add tenants',
  },
  'invite-bulk': {
    title: 'Bulk add with CSV',
    body: 'Download the template, fill name / email / unit / phone, upload, review the status column, then add up to 100 at a time.',
    hint: 'This is Option 1 on the left',
  },
  'invite-single': {
    title: 'Or add one tenant',
    body: 'Enter email, first name, and unit, then create the invitation. Show or print the QR so they can finish setup after installing the app.',
    hint: 'This is Option 2 on the right',
  },
}

const SPOTLIGHT_ORDER: PmTourSpotlightStep[] = [
  'nav-tenants',
  'add-tenants',
  'invite-bulk',
  'invite-single',
]

interface PmShowcaseTourProps {
  step: PmTourStep
  onSkip: () => void
  onNext: () => void
}

const PAD = 8
const PANEL_TRANSITION =
  'top 420ms ease, left 420ms ease, width 420ms ease, height 420ms ease, right 420ms ease, bottom 420ms ease'

const PmShowcaseTour = ({ step, onSkip, onNext }: PmShowcaseTourProps) => {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [tooltipKey, setTooltipKey] = useState(0)
  const [welcomeExiting, setWelcomeExiting] = useState(false)

  const isWelcome = step === 'welcome'
  const spotlightStep = isPmTourSpotlightStep(step) ? step : null
  const copy = spotlightStep ? COPY[spotlightStep] : null
  const stepIndex = spotlightStep ? SPOTLIGHT_ORDER.indexOf(spotlightStep) : -1
  const isClickStep = spotlightStep === 'nav-tenants' || spotlightStep === 'add-tenants'
  const isLast = spotlightStep === 'invite-single'

  useLayoutEffect(() => {
    if (!spotlightStep) {
      setRect(null)
      return
    }

    const selector = PM_TOUR_TARGETS[spotlightStep]
    let frame = 0

    const measure = () => {
      const el = document.querySelector(selector) as HTMLElement | null
      if (!el) {
        setRect(null)
        return
      }
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      setRect(el.getBoundingClientRect())
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    setTooltipKey((k) => k + 1)
    // Slight delay so welcome exit / sidebar open can settle before measuring
    const start = window.setTimeout(schedule, spotlightStep === 'nav-tenants' ? 280 : 40)
    const retries = [120, 280, 500, 800].map((ms) => window.setTimeout(schedule, ms))

    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      window.clearTimeout(start)
      cancelAnimationFrame(frame)
      retries.forEach((id) => window.clearTimeout(id))
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [spotlightStep])

  useEffect(() => {
    if (!spotlightStep) return
    const selector = PM_TOUR_TARGETS[spotlightStep]
    const el = document.querySelector(selector)
    if (!el) return

    const onTargetClick = () => {
      if (spotlightStep === 'nav-tenants' || spotlightStep === 'add-tenants') {
        window.setTimeout(() => onNext(), 0)
      }
    }

    el.addEventListener('click', onTargetClick)
    return () => el.removeEventListener('click', onTargetClick)
  }, [spotlightStep, onNext])

  const beginShowcase = () => {
    if (welcomeExiting) return
    setWelcomeExiting(true)
    window.setTimeout(() => {
      onNext()
      setWelcomeExiting(false)
    }, 420)
  }

  if (isWelcome) {
    return (
      <div
        className={`fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] ${
          welcomeExiting ? 'tour-welcome-out' : 'tour-welcome-in'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-welcome-title"
      >
        <div
          className={`w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ${
            welcomeExiting ? 'tour-welcome-card-out' : 'tour-welcome-card-in'
          }`}
        >
          <div className="bg-gradient-to-br from-teal-800 via-teal-700 to-teal-600 px-6 pb-8 pt-7 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Sparkles className="h-6 w-6 text-teal-100" />
              </div>
              <button
                type="button"
                onClick={onSkip}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-teal-100 transition hover:bg-white/10"
                aria-label="Skip guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h2 id="pm-welcome-title" className="mt-5 text-2xl font-bold tracking-tight">
              Welcome to your Asine dashboard
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-teal-50">
              A quick walkthrough will show you how to add tenants — one at a time or in bulk with a
              CSV — so work orders can start flowing.
            </p>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
              <p className="text-sm leading-relaxed text-teal-900">
                Next we will highlight <span className="font-semibold">Tenants</span> in the sidebar.
                Tap it when it lights up.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="min-h-11 rounded-lg px-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={beginShowcase}
                disabled={welcomeExiting}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-70"
              >
                Show me around
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const top = rect ? Math.max(0, rect.top - PAD) : 0
  const left = rect ? Math.max(0, rect.left - PAD) : 0
  const width = rect ? rect.width + PAD * 2 : 0
  const height = rect ? rect.height + PAD * 2 : 0
  const bottom = top + height
  const right = left + width
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0

  const tooltipStyle: CSSProperties = (() => {
    if (!rect) return { top: '30%', left: '50%', transform: 'translateX(-50%)' }
    const placeBelow = rect.bottom + 180 < vh
    if (placeBelow) {
      return {
        top: Math.min(vh - 200, bottom + 12),
        left: Math.min(vw - 360, Math.max(16, left)),
      }
    }
    return {
      top: Math.max(16, top - 12),
      left: Math.min(vw - 360, Math.max(16, left)),
      transform: 'translateY(-100%)',
    }
  })()

  return (
    <div className="tour-spotlight-stage pointer-events-none fixed inset-0 z-[80]" aria-live="polite">
      {rect ? (
        <>
          <div
            className="pointer-events-auto absolute bg-black/50"
            style={{ top: 0, left: 0, right: 0, height: top, transition: PANEL_TRANSITION }}
          />
          <div
            className="pointer-events-auto absolute bg-black/50"
            style={{ top: bottom, left: 0, right: 0, bottom: 0, transition: PANEL_TRANSITION }}
          />
          <div
            className="pointer-events-auto absolute bg-black/50"
            style={{ top, left: 0, width: left, height, transition: PANEL_TRANSITION }}
          />
          <div
            className="pointer-events-auto absolute bg-black/50"
            style={{ top, left: right, right: 0, height, transition: PANEL_TRANSITION }}
          />
          <div
            className="tour-spotlight-ring pointer-events-none absolute rounded-xl border-2 border-teal-300 bg-teal-400/10"
            style={{ top, left, width, height, transition: PANEL_TRANSITION }}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/40 transition-opacity duration-500" />
      )}

      {copy && (
        <div
          className="pointer-events-auto absolute z-[81] w-[min(100%-2rem,22rem)] transition-[top,left] duration-500 ease-out"
          style={tooltipStyle}
        >
          <div
            key={`${step}-${tooltipKey}`}
            className="tour-tooltip-in rounded-2xl bg-white p-4 shadow-2xl"
            role="dialog"
            aria-labelledby="pm-showcase-title"
          >
            <div className="mb-3 flex gap-1.5">
              {SPOTLIGHT_ORDER.map((id, i) => (
                <div
                  key={id}
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    i <= stepIndex ? 'scale-y-125 bg-teal-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                  Setup guide · {stepIndex + 1} of {SPOTLIGHT_ORDER.length}
                </p>
                <h2 id="pm-showcase-title" className="mt-1 text-base font-bold text-gray-900">
                  {copy.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onSkip}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
                aria-label="Skip guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{copy.body}</p>
            <p
              className={`mt-2 text-xs font-semibold text-teal-700 ${isClickStep ? 'tour-hint-nudge inline-block' : ''}`}
            >
              {copy.hint}
              {isClickStep ? ' →' : ''}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onSkip}
                className="min-h-10 rounded-lg px-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
              >
                Skip
              </button>
              {!isClickStep && (
                <button
                  type="button"
                  onClick={onNext}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white transition hover:bg-teal-700 active:scale-[0.98]"
                >
                  {isLast ? 'Done' : 'Next'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PmShowcaseTour
