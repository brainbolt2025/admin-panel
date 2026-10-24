/** Shared marketing URL → source files for honest lastmod (git). */
export const SITE_ORIGIN = 'https://www.sycnmore.com'

/** @type {{ path: string, sources: string[] }[]} */
export const SEO_PAGES = [
  {
    path: '/',
    sources: [
      'index.html',
      'src/components/GuestLanding.tsx',
      'src/components/WorkOrderProductPreview.tsx',
    ],
  },
  {
    path: '/pricing',
    sources: ['pricing.html', 'src/components/GuestLanding.tsx'],
  },
  {
    path: '/about',
    sources: ['about.html', 'src/components/GuestLanding.tsx', 'public/juan-romero.jpg'],
  },
  {
    path: '/features',
    sources: [
      'features.html',
      'src/components/GuestLanding.tsx',
      'src/components/WorkOrderProductPreview.tsx',
    ],
  },
  {
    path: '/vs/asine-vs-property-meld',
    sources: [
      'vs/asine-vs-property-meld.html',
      'src/components/ComparisonPage.tsx',
      'src/lib/comparisonPages.ts',
    ],
  },
  {
    path: '/vs/asine-vs-buildium',
    sources: [
      'vs/asine-vs-buildium.html',
      'src/components/ComparisonPage.tsx',
      'src/lib/comparisonPages.ts',
    ],
  },
  {
    path: '/privacy',
    sources: ['public/privacy-policy.html'],
  },
]

export const INDEXNOW_KEY = 'asine-indexnow-7c4e9f2a1b8d'
