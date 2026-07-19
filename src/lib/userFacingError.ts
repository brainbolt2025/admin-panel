/** Map technical API/DB errors to short copy suitable for the UI. */
export function toUserFacingError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : typeof error === 'string'
          ? error
          : ''

  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code
      : ''

  const message = raw.trim()
  if (!message && !code) return fallback

  const lower = message.toLowerCase()
  const codeUpper = code.toUpperCase()

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed')
  ) {
    return 'Unable to connect. Check your internet connection and try again.'
  }

  if (
    lower.includes('infinite recursion') ||
    lower.includes('row-level security') ||
    lower.includes('permission') ||
    lower.includes('not authorized') ||
    lower.includes('jwt') ||
    (lower.includes('policy') && lower.includes('violation'))
  ) {
    return "You don't have permission to view this. Please contact support if this continues."
  }

  // .single() with 0 or multiple rows (PGRST116)
  if (
    codeUpper === 'PGRST116' ||
    lower.includes('cannot coerce') ||
    lower.includes('single json object') ||
    lower.includes('0 rows') ||
    lower.includes('multiple (or no) rows')
  ) {
    return 'Your account profile could not be loaded. Please sign in again or contact support.'
  }

  if (
    lower.includes('schema cache') ||
    lower.includes('could not find a relationship') ||
    lower.includes('could not find the table') ||
    lower.includes('does not exist') ||
    codeUpper === '42703'
  ) {
    return 'This data is temporarily unavailable. Please try again later.'
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'The request took too long. Please try again.'
  }

  if (
    lower.includes('email not confirmed') ||
    lower.includes('email_not_confirmed')
  ) {
    return 'Please verify your email before signing in.'
  }

  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.'
  }

  if (lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  // Prefer the caller's fallback over opaque API wording
  const looksTechnical =
    /PGRST|postgres|supabase|foreign key|constraint|null value|stack|at Object\.|TypeError|column "|relation "|coerce|json object/i.test(
      message
    ) ||
    codeUpper.startsWith('PGRST') ||
    message.length > 120 ||
    (message.includes('_') && !message.includes(' '))

  if (looksTechnical) return fallback

  return message
}
