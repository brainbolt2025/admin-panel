const TUTORIAL_PREFIX = 'asine_pm_tenant_tutorial_seen_'
export const OPEN_INVITE_TENANTS_KEY = 'asine_open_invite_tenants'

export type PmTourSpotlightStep =
  | 'nav-tenants'
  | 'add-tenants'
  | 'invite-bulk'
  | 'invite-single'

export type PmTourStep = 'welcome' | PmTourSpotlightStep

export const PM_TOUR_TARGETS: Record<PmTourSpotlightStep, string> = {
  'nav-tenants': '[data-tour="pm-nav-tenants"]',
  'add-tenants': '[data-tour="pm-add-tenants"]',
  'invite-bulk': '[data-tour="pm-invite-bulk"]',
  'invite-single': '[data-tour="pm-invite-single"]',
}

export function isPmTourSpotlightStep(step: PmTourStep): step is PmTourSpotlightStep {
  return step !== 'welcome'
}

export function getStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const user = JSON.parse(raw) as { id?: string; user_id?: string }
    return user.id || user.user_id || null
  } catch {
    return null
  }
}

export function hasSeenPmTenantTutorial(userId: string | null): boolean {
  if (!userId) return true
  try {
    return localStorage.getItem(`${TUTORIAL_PREFIX}${userId}`) === '1'
  } catch {
    return true
  }
}

export function markPmTenantTutorialSeen(userId: string | null) {
  if (!userId) return
  try {
    localStorage.setItem(`${TUTORIAL_PREFIX}${userId}`, '1')
  } catch {
    // Ignore private browsing / quota errors
  }
}

export function requestOpenInviteTenants() {
  try {
    sessionStorage.setItem(OPEN_INVITE_TENANTS_KEY, '1')
  } catch {
    // Ignore
  }
}

export function consumeOpenInviteTenants(): boolean {
  try {
    if (sessionStorage.getItem(OPEN_INVITE_TENANTS_KEY) !== '1') return false
    sessionStorage.removeItem(OPEN_INVITE_TENANTS_KEY)
    return true
  } catch {
    return false
  }
}
