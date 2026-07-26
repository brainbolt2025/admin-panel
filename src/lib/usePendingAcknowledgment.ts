import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_PREFIX = 'asine_pending_ack_ids'

const readSeenIds = (storageKey: string): string[] => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
    }
    // Legacy numeric ack format — ignore so a new pending item can show again
    return []
  } catch {
    return []
  }
}

const writeSeenIds = (storageKey: string, ids: string[]) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids))
  } catch {
    // Ignore storage errors (e.g. private browsing)
  }
}

const normalizePendingIds = (pendingIds: unknown): string[] => {
  if (!Array.isArray(pendingIds)) return []
  return pendingIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

/**
 * Tracks whether a sidebar section has pending items the PM hasn't seen yet.
 * Visiting the section (calling `acknowledge`) remembers the current pending
 * IDs. The red dot returns when any new pending ID appears — even if the
 * total count stayed the same after an approve + new registration.
 */
export function usePendingAcknowledgment(
  section: string,
  propertyId: string | null | undefined,
  pendingIds: string[]
) {
  const storageKey = propertyId ? `${STORAGE_PREFIX}_${section}_${propertyId}` : null
  const ids = useMemo(() => normalizePendingIds(pendingIds), [pendingIds])

  const [seenIds, setSeenIds] = useState<string[]>(() =>
    storageKey ? readSeenIds(storageKey) : []
  )

  useEffect(() => {
    setSeenIds(storageKey ? readSeenIds(storageKey) : [])
  }, [storageKey])

  const acknowledge = useCallback(() => {
    if (!storageKey) return
    setSeenIds(ids)
    writeSeenIds(storageKey, ids)
  }, [storageKey, ids])

  const hasUnseenPending = useMemo(() => {
    if (ids.length === 0) return false
    const seen = new Set(seenIds)
    return ids.some((id) => !seen.has(id))
  }, [ids, seenIds])

  return { hasUnseenPending, acknowledge }
}
