export type ComparisonRow = {
  label: string
  asine: string
  rival: string
}

export type ComparisonFaq = {
  question: string
  answer: string
}

export type ComparisonPageData = {
  slug: 'asine-vs-property-meld' | 'asine-vs-buildium'
  path: string
  rivalName: string
  rivalShort: string
  eyebrow: string
  title: string
  lede: string
  pricingAsOf: string
  rows: ComparisonRow[]
  mathTitle: string
  mathBody: string[]
  whenNotTitle: string
  whenNotBody: string[]
  whenYesTitle: string
  whenYesBody: string[]
  faqs: ComparisonFaq[]
  otherComparison: { href: string; label: string }
}

export const COMPARISON_PAGES: Record<
  ComparisonPageData['slug'],
  ComparisonPageData
> = {
  'asine-vs-property-meld': {
    slug: 'asine-vs-property-meld',
    path: '/vs/asine-vs-property-meld',
    rivalName: 'Property Meld',
    rivalShort: 'Property Meld',
    eyebrow: 'Comparison',
    title: 'Asine vs Property Meld',
    lede:
      'Both tools focus on residential maintenance coordination. The difference is how you pay and how recurring repairs are handled: Asine is one flat price with reopenable work orders; Property Meld publishes per-unit plans with a monthly minimum.',
    pricingAsOf: 'Competitor list prices cited as of October 2026 from public Property Meld pricing pages. Always confirm current rates with the vendor.',
    rows: [
      {
        label: 'Pricing model',
        asine: 'Flat monthly or yearly — not per unit',
        rival: 'Per unit / month (Core and Ops tiers)',
      },
      {
        label: 'Published entry cost',
        asine: '$199.99/month or $1,919.99/year',
        rival: 'Core from $1.60/unit; Ops from $2.00/unit; public materials also cite a $160/month minimum',
      },
      {
        label: 'Unlimited units',
        asine: 'Yes — price does not rise with doors',
        rival: 'Cost scales with unit count (plus any minimum)',
      },
      {
        label: 'Reopenable work orders',
        asine: 'Tenants reopen the same request with photos and chat history',
        rival: 'Strong intake and coordination workflows; reopen-on-the-same-thread is not their public headline feature',
      },
      {
        label: 'Best fit (honest)',
        asine: 'PMs who want maintenance work orders alongside an existing PMS',
        rival: 'Operators building a dedicated maintenance stack, often 100+ doors',
      },
    ],
    mathTitle: 'The per-unit math, expanded',
    mathBody: [
      'At a published $2.00 per unit (Property Meld Ops list price), 100 units is about $200/month — roughly the same as Asine’s flat $199.99/month.',
      'At 200 units, $2.00/unit is about $400/month; Asine stays $199.99/month.',
      'At 50 units, a $160 monthly minimum (when it applies) can make Property Meld cheaper than Asine’s flat rate. If you are well under ~100 doors, run both quotes before you decide.',
      'Asine includes unlimited units, tenants, and technicians on every plan. There is no per-door overage as you grow.',
    ],
    whenNotTitle: 'When not to choose Asine',
    whenNotBody: [
      'Choose Property Meld (or stay on it) if you need their AI intake, after-hours call add-ons, deep vendor logistics, or native sync with a PMS they already support.',
      'Choose them if your portfolio is small enough that their per-unit + minimum math beats a flat ~$200/month.',
      'Asine does not replace Property Meld’s full maintenance-ops feature set — it is a focused work-order product with photo requests, tenant–technician chat, and reopen.',
    ],
    whenYesTitle: 'When Asine is the better fit',
    whenYesBody: [
      'You want predictable cost as you add doors, without renegotiating per-unit fees.',
      'Recurring repairs are a pain: tenants should reopen the same work order instead of starting a new ticket.',
      'You already have a PMS for accounting/leasing and only need a clearer maintenance layer.',
    ],
    faqs: [
      {
        question: 'Is Asine a Property Meld alternative?',
        answer:
          'Yes for teams that mainly need work orders, photos, chat, and reopen on a flat price. It is not a feature-for-feature replacement for Property Meld’s ops, analytics, and call-center add-ons.',
      },
      {
        question: 'How does Asine pricing compare to Property Meld’s $2/unit?',
        answer:
          'Asine is $199.99/month flat (or $1,919.99/year). At $2/unit, about 100 units matches Asine’s monthly price; above that, the flat fee usually wins. Below that, check Property Meld’s minimums — they may be lower.',
      },
      {
        question: 'Does Asine integrate with Property Meld?',
        answer:
          'No. Asine runs alongside your existing tools. There is no Property Meld sync today.',
      },
      {
        question: 'Can I try Asine before switching?',
        answer:
          'Yes. Contact us for a unique 30-day trial code. Enter it at checkout so the first invoice is $0. Cancel before the trial ends and you are never charged.',
      },
    ],
    otherComparison: {
      href: '/vs/asine-vs-buildium',
      label: 'Asine vs Buildium',
    },
  },
  'asine-vs-buildium': {
    slug: 'asine-vs-buildium',
    path: '/vs/asine-vs-buildium',
    rivalName: 'Buildium',
    rivalShort: 'Buildium',
    eyebrow: 'Comparison',
    title: 'Asine vs Buildium',
    lede:
      'Buildium is a full property management platform (accounting, leasing, residents, and maintenance). Asine is not a Buildium replacement — it is a flat-priced work-order layer for residential PMs who want tenants, photos, and technician chat on one request, including reopen when a repair comes back.',
    pricingAsOf:
      'Buildium package starting prices cited as of October 2026 from public Buildium pricing pages. Buildium bills as an all-in-one PMS; Asine bills only for maintenance work orders. Confirm current Buildium quotes with Buildium.',
    rows: [
      {
        label: 'Product type',
        asine: 'Maintenance work orders (photos, chat, reopen)',
        rival: 'All-in-one PMS: accounting, leasing, residents, maintenance',
      },
      {
        label: 'Pricing model',
        asine: 'Flat $199.99/month or $1,919.99/year — unlimited units',
        rival: 'Tiered packages starting ~$62 / $192 / $400 per month (Essential / Growth / Premium), with add-ons',
      },
      {
        label: 'Unlimited units on the base fee',
        asine: 'Yes',
        rival: 'Package price is not a simple unlimited maintenance-only fee; portfolio size and add-ons affect total cost',
      },
      {
        label: 'Reopenable work orders',
        asine: 'First-class: same request, photos, and chat history',
        rival: 'Work orders and resident requests are included; reopen-as-a-headline workflow is not Asine’s differentiator there',
      },
      {
        label: 'Integrations',
        asine: 'Standalone today — works alongside a PMS, no Buildium sync',
        rival: 'Native accounting + leasing + maintenance in one system',
      },
    ],
    mathTitle: 'How to think about cost (not an apples-to-apples swap)',
    mathBody: [
      'Do not compare Asine’s $199.99/month to Buildium’s whole-platform fee as if they buy the same thing. Buildium’s Essential/Growth/Premium packages bundle accounting and leasing; Asine does not.',
      'If you already pay for Buildium (or another PMS) and still want a clearer maintenance experience — flat unlimited units, photo work orders, tenant–technician chat, reopen — Asine is an add-on cost, not a rip-and-replace.',
      'If you need one system for books, leasing, and maintenance, Buildium (or a peer PMS) is the right category; Asine is not.',
      'Optional Buildium maintenance add-ons (for example contact-center style services) are priced separately on their site; Asine does not offer a human call center.',
    ],
    whenNotTitle: 'When not to choose Asine',
    whenNotBody: [
      'You need accounting, owner statements, leasing, screening, or a single resident portal for rent + maintenance — stay on Buildium or another full PMS.',
      'You require Buildium-native maintenance so every dollar posts into the same ledger without a second tool.',
      'Your team will not adopt a separate Android app for tenants and technicians.',
      'You manage only a handful of units; Asine is aimed at portfolios from about 20 doors up.',
    ],
    whenYesTitle: 'When Asine is the better fit',
    whenYesBody: [
      'Buildium (or another PMS) already covers accounting and leasing, but maintenance tickets still create PM middleman work.',
      'You want flat, predictable maintenance software pricing as the portfolio grows.',
      'Recurring repairs should reopen on the same work order with history intact.',
    ],
    faqs: [
      {
        question: 'Is Asine a Buildium alternative?',
        answer:
          'Only for the maintenance work-order slice. Asine is not a full Buildium alternative for accounting, leasing, or screening.',
      },
      {
        question: 'Does Asine integrate with Buildium?',
        answer:
          'Not today. Asine runs alongside Buildium. There is no Buildium sync, import, or two-way work-order bridge yet.',
      },
      {
        question: 'Why would I pay for both?',
        answer:
          'If Buildium is your system of record but tenants, photos, and techs still bounce through email or the PM inbox, Asine can be the maintenance front door at a flat fee while Buildium keeps the books.',
      },
      {
        question: 'How do I try Asine?',
        answer:
          'Contact us for a unique 30-day trial code, or get started on a paid plan. Trial codes make the first invoice $0 for 30 days if you cancel in time.',
      },
    ],
    otherComparison: {
      href: '/vs/asine-vs-property-meld',
      label: 'Asine vs Property Meld',
    },
  },
}

export function comparisonSlugFromPath(pathname: string): ComparisonPageData['slug'] | null {
  const path = pathname.replace(/\/$/, '')
  if (path === '/vs/asine-vs-property-meld') return 'asine-vs-property-meld'
  if (path === '/vs/asine-vs-buildium') return 'asine-vs-buildium'
  return null
}
