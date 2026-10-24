/**
 * Annotated product preview for the landing page.
 * Shows a reopened work order with real photos and technician chat (static demo UI).
 */
const PHOTOS = [
  {
    src: '/product-preview/sink-base.jpg',
    alt: 'Under-sink cabinet with water-stained base and dark mold along the front edge, garbage disposal and PVC drain visible',
    label: 'Sink base',
  },
  {
    src: '/product-preview/cabinet-floor.jpg',
    alt: 'Open kitchen cabinet floor with peeling liner and damage around a black base plate',
    label: 'Cabinet floor',
  },
  {
    src: '/product-preview/after-reopen.jpg',
    alt: 'Under-sink plumbing after repair: clean white PVC drains, black disposal, and hot and cold supply lines',
    label: 'After reopen',
  },
] as const

const WorkOrderProductPreview = () => {
  return (
    <figure className="relative">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-medium text-slate-500">asine · work order</span>
        </div>

        <div className="space-y-3 bg-[#f8faf9] p-3 sm:p-4">
          <div className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Unit 2B · Riverview Apartments
                </p>
                <h3 className="text-sm font-bold text-slate-900">Kitchen sink leak — recurring</h3>
              </div>
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#c25e38]">
                Reopened
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
              Same drip under the cabinet came back two weeks after the first repair. Tenant reopened
              this work order instead of filing a new one.
            </p>

            <div className="pointer-events-none absolute -right-1 -top-3 hidden sm:block">
              <span className="rounded-md bg-[#143d32] px-2 py-1 text-[10px] font-semibold text-emerald-100 shadow">
                Same ticket, not a new one
              </span>
            </div>
          </div>

          <div className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Photos on this request
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PHOTOS.map((photo) => (
                <div key={photo.src} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <p className="border-t border-slate-100 bg-white px-1.5 py-1 text-center text-[9px] font-medium text-slate-600">
                    {photo.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute -left-1 bottom-8 hidden sm:block">
              <span className="rounded-md bg-[#143d32] px-2 py-1 text-[10px] font-semibold text-emerald-100 shadow">
                History stays attached
              </span>
            </div>
          </div>

          <div className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Tenant ↔ technician chat
            </p>
            <div className="space-y-2">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-[11px] text-slate-700">
                <span className="font-semibold text-slate-900">Tenant · Maya</span>
                <p className="mt-0.5">It started dripping again overnight. Reopened so you have the old photos.</p>
              </div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#d8f3dc] px-3 py-2 text-[11px] text-[#143d32]">
                <span className="font-semibold">Tech · Luis</span>
                <p className="mt-0.5">Got it — I see the reopen. On-site tomorrow 9am with the prior parts list.</p>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-1 top-8 hidden sm:block">
              <span className="rounded-md bg-[#143d32] px-2 py-1 text-[10px] font-semibold text-emerald-100 shadow">
                No PM middleman
              </span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-emerald-100/80 sm:text-left">
        Reopened work order with tenant photos and technician chat — the after-state without pressing
        play.
      </figcaption>
    </figure>
  )
}

export default WorkOrderProductPreview
