const CREDENTIALS_KEY = 'asine_pending_pm_signup'
const LOGIN_HINT_KEY = 'asine_pm_signup_login_hint'

export interface PendingPmSignupCredentials {
  email: string
  password: string
}

/** Store credentials briefly so we can auto-login after Stripe Checkout returns. */
export function savePendingPmSignupCredentials(credentials: PendingPmSignupCredentials) {
  try {
    sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
  } catch {
    // Ignore storage errors (e.g. private browsing)
  }
}

export function readPendingPmSignupCredentials(): PendingPmSignupCredentials | null {
  try {
    const raw = sessionStorage.getItem(CREDENTIALS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingPmSignupCredentials
    if (
      typeof parsed?.email === 'string' &&
      parsed.email &&
      typeof parsed?.password === 'string' &&
      parsed.password
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function clearPendingPmSignupCredentials() {
  try {
    sessionStorage.removeItem(CREDENTIALS_KEY)
  } catch {
    // ignore
  }
}

/** Shown on Login when auto-login after payment fails. */
export function setPmSignupLoginHint() {
  try {
    sessionStorage.setItem(LOGIN_HINT_KEY, '1')
  } catch {
    // ignore
  }
}

export function consumePmSignupLoginHint(): boolean {
  try {
    const value = sessionStorage.getItem(LOGIN_HINT_KEY)
    if (value) {
      sessionStorage.removeItem(LOGIN_HINT_KEY)
      return true
    }
    return false
  } catch {
    return false
  }
}
