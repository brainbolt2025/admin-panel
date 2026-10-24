import { useState } from 'react'
import { ArrowRight, Check, Menu, X } from 'lucide-react'
import AsineLogo from './AsineLogo'
import logoFinal from '../assets/Logo-Final.png'
import { COMPARISON_PAGES, type ComparisonPageData } from '../lib/comparisonPages'

interface ComparisonPageProps {
  slug: ComparisonPageData['slug']
  onGetStarted: () => void
  onSignIn: () => void
}

const ComparisonPage = ({ slug, onGetStarted, onSignIn }: ComparisonPageProps) => {
  const page = COMPARISON_PAGES[slug]
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="bg-asine-map flex min-h-screen flex-col text-slate-800">
      <header className="sticky top-0 z-40 border-b border-[#2c6e59]/40 bg-[#143d32] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="/" className="rounded-xl bg-white px-2 py-1" aria-label="Asine home">
            <AsineLogo size="sm" src={logoFinal} blendOnWhite className="[&_img]:!h-8" />
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-emerald-100/90 lg:flex">
            <a href="/features" className="hover:text-white">
              Features
            </a>
            <a href="/pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="/about" className="hover:text-white">
              About
            </a>
            <a href="/vs/asine-vs-property-meld" className="hover:text-white">
              vs Property Meld
            </a>
            <a href="/vs/asine-vs-buildium" className="hover:text-white">
              vs Buildium
            </a>
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
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#38826b]/50 text-emerald-100 lg:hidden"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav className="border-t border-[#2c6e59]/40 px-4 py-3 lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {[
                ['/features', 'Features'],
                ['/pricing', 'Pricing'],
                ['/about', 'About'],
                ['/vs/asine-vs-property-meld', 'Asine vs Property Meld'],
                ['/vs/asine-vs-buildium', 'Asine vs Buildium'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium text-emerald-100 hover:bg-[#1b4d3e] hover:text-white"
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2c6e59]">{page.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {page.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">{page.lede}</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{page.pricingAsOf}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onGetStarted}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1b4d3e] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#143d32]"
            >
              Get Started
              <ArrowRight className="h-4 w-4 text-emerald-300" />
            </button>
            <a
              href="/#contact"
              className="inline-flex min-h-11 items-center rounded-xl border border-[#2c6e59] px-5 py-2.5 text-sm font-semibold text-[#1b4d3e] transition hover:bg-[#f0fdf4]"
            >
              Ask for a 30-day trial code
            </a>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 bg-[#143d32] px-6 py-4 sm:px-8">
            <h2 className="text-lg font-bold text-white">Side-by-side comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-700 sm:px-6">Topic</th>
                  <th className="px-4 py-3 font-semibold text-[#1b4d3e] sm:px-6">Asine</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 sm:px-6">{page.rivalShort}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 align-top">
                    <th className="px-4 py-4 font-semibold text-slate-800 sm:px-6">{row.label}</th>
                    <td className="px-4 py-4 text-slate-700 sm:px-6">{row.asine}</td>
                    <td className="px-4 py-4 text-slate-600 sm:px-6">{row.rival}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-[#2c6e59] bg-[#1b4d3e] p-6 text-white shadow-xl sm:p-10">
          <h2 className="text-2xl font-extrabold tracking-tight">{page.mathTitle}</h2>
          <ul className="mt-5 space-y-3">
            {page.mathBody.map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-emerald-50/95">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#52b788]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
            <h2 className="text-xl font-extrabold text-slate-900">{page.whenYesTitle}</h2>
            <ul className="mt-4 space-y-3">
              {page.whenYesBody.map((line) => (
                <li key={line} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2c6e59]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
            <h2 className="text-xl font-extrabold text-slate-900">{page.whenNotTitle}</h2>
            <ul className="mt-4 space-y-3">
              {page.whenNotBody.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-slate-600">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-10">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Frequently asked questions
          </h2>
          <div className="mt-6 divide-y divide-slate-200 border-t border-b border-slate-200">
            {page.faqs.map((faq) => (
              <details key={faq.question} className="group py-1">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                </summary>
                <p className="pb-4 pr-4 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg sm:p-10">
          <h2 className="text-2xl font-extrabold text-slate-900">Ready to see Asine on your portfolio?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Get started on a plan, or ask for a 30-day trial code so the first invoice is $0.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onGetStarted}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1b4d3e] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#143d32]"
            >
              Get Started
              <ArrowRight className="h-4 w-4 text-emerald-300" />
            </button>
            <a
              href={page.otherComparison.href}
              className="inline-flex min-h-11 items-center rounded-xl border border-[#2c6e59] px-5 py-2.5 text-sm font-semibold text-[#1b4d3e] transition hover:bg-[#f0fdf4]"
            >
              {page.otherComparison.label}
            </a>
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
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a href="/" className="underline hover:text-white">
              Home
            </a>
            <a href="/pricing" className="underline hover:text-white">
              Pricing
            </a>
            <a href="/vs/asine-vs-property-meld" className="underline hover:text-white">
              vs Property Meld
            </a>
            <a href="/vs/asine-vs-buildium" className="underline hover:text-white">
              vs Buildium
            </a>
            <a href="/privacy" className="underline hover:text-white">
              Privacy policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default ComparisonPage
