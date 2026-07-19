import type { PendingAlerts } from './pmQueries'

const STORAGE_PREFIX = 'asine_alerts_seen_ids'

export type AlertItemKey = `wo:${string}` | `tech:${string}` | `tenant:${string}`

const storageKeyFor = (propertyId: string) => `${STORAGE_PREFIX}_${propertyId}`

export function alertKeyForWorkOrder(id: string): AlertItemKey {
  return `wo:${id}`
}

export function alertKeyForTechnician(id: string): AlertItemKey {
  return `tech:${id}`
}

export function alertKeyForTenant(id: string): AlertItemKey {
  return `tenant:${id}`
}

export function readSeenAlertKeys(propertyId: string | null | undefined): Set<string> {
  if (!propertyId) return new Set()
  try {
    const raw = localStorage.getItem(storageKeyFor(propertyId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return new Set()
  }
}

function writeSeenAlertKeys(propertyId: string, keys: Iterable<string>) {
  try {
    localStorage.setItem(storageKeyFor(propertyId), JSON.stringify([...keys]))
  } catch {
    // Ignore storage errors (e.g. private browsing)
  }
}

export function collectAlertKeys(alerts: PendingAlerts): AlertItemKey[] {
  return [
    ...alerts.workOrders.map((item) => alertKeyForWorkOrder(item.id)),
    ...alerts.technicians.map((item) => alertKeyForTechnician(item.id)),
    ...alerts.tenants.map((item) => alertKeyForTenant(item.id)),
  ]
}

export function getUnseenAlertKeys(
  alerts: PendingAlerts,
  seenKeys: Set<string>
): Set<string> {
  return new Set(collectAlertKeys(alerts).filter((key) => !seenKeys.has(key)))
}

/**
 * Mark every currently listed alert as seen and drop keys for items that
 * are no longer pending so storage stays small.
 */
export function markAlertsSeen(
  propertyId: string | null | undefined,
  alerts: PendingAlerts
): Set<string> {
  if (!propertyId) return new Set()

  const currentKeys = new Set<string>(collectAlertKeys(alerts))
  const next = readSeenAlertKeys(propertyId)
  for (const key of currentKeys) {
    next.add(key)
  }

  // Keep only keys that still refer to a currently pending item
  const pruned = new Set([...next].filter((key) => currentKeys.has(key)))
  writeSeenAlertKeys(propertyId, pruned)
  return pruned
}
