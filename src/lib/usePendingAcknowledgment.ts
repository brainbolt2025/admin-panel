import { useCallback, useEffect, useState } from 'react'

const STORAGE_PREFIX = 'asine_pending_ack'

const readAcknowledgedCount = (storageKey: string): number => {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

const writeAcknowledgedCount = (storageKey: string, count: number) => {
  try {
    localStorage.setItem(storageKey, String(count))
  } catch {
    // Ignore storage errors (e.g. private browsing)
  }
}

/**
 * Tracks whether a sidebar "pending" count has any items the PM hasn't
 * seen yet. Visiting the section (calling `acknowledge`) hides the dot by
 * remembering the count at that moment; the dot reappears only once the
 * live count rises above what was last acknowledged (i.e. a new item
 * arrived), not just because something was approved/rejected.
 */
export function usePendingAcknowledgment(section: string, propertyId: string | null | undefined, currentCount: number) {
  const storageKey = propertyId ? `${STORAGE_PREFIX}_${section}_${propertyId}` : null

  const [acknowledgedCount, setAcknowledgedCount] = useState<number>(() =>
    storageKey ? readAcknowledgedCount(storageKey) : 0
  )

  // Reload the acknowledged count when switching properties/accounts
  useEffect(() => {
    setAcknowledgedCount(storageKey ? readAcknowledgedCount(storageKey) : 0)
  }, [storageKey])

  const acknowledge = useCallback(() => {
    if (!storageKey) return
    setAcknowledgedCount(currentCount)
    writeAcknowledgedCount(storageKey, currentCount)
  }, [storageKey, currentCount])

  const hasUnseenPending = currentCount > acknowledgedCount

  return { hasUnseenPending, acknowledge }
}
