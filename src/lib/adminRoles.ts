/** Roles allowed to use the web admin panel (not the mobile tenant/tech app). */
export const ADMIN_PANEL_ROLES = ['pm', 'super_admin'] as const

export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number]

export function isAdminPanelRole(role: string | null | undefined): boolean {
  return role === 'pm' || role === 'super_admin'
}

export const ADMIN_PANEL_ACCESS_DENIED_MESSAGE =
  'This portal is for property managers only. Please use the Asine mobile app.'

const DENIED_FLAG_KEY = 'asine_admin_login_denied'

export function markAdminPanelAccessDenied() {
  try {
    sessionStorage.setItem(DENIED_FLAG_KEY, '1')
  } catch {
    // ignore
  }
}

export function consumeAdminPanelAccessDenied(): boolean {
  try {
    const denied = sessionStorage.getItem(DENIED_FLAG_KEY) === '1'
    if (denied) sessionStorage.removeItem(DENIED_FLAG_KEY)
    return denied
  } catch {
    return false
  }
}
