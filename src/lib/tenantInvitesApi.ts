import { config } from '../config'

export interface TenantInviteInput {
  email: string
  first_name?: string
  last_name?: string
  name?: string
  unit_number: string
  phone?: string
}

export interface TenantInviteResult {
  email?: string
  invite_id?: string
  first_name?: string
  last_name?: string
  unit_number?: string
  phone?: string | null
  token?: string
  expires_at?: string
  app_link?: string
  https_link?: string
  qr_link?: string
  error?: string
}

export interface CreateTenantInvitesResponse {
  success?: boolean
  created?: number
  failed?: number
  play_store_url?: string
  error?: string
  results?: TenantInviteResult[]
}

async function postCreateTenantInvites(body: {
  tenants?: TenantInviteInput[]
  refresh_invite_id?: string
}): Promise<CreateTenantInvitesResponse> {
  const accessToken = localStorage.getItem('access_token')
  if (!accessToken) {
    throw new Error('You are not authenticated. Please log in again.')
  }

  let response: Response
  try {
    response = await fetch(config.api.createTenantInvites, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: config.supabase.anonKey,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(
      'Could not reach the server. Check your connection, then log in again and retry.',
    )
  }

  const data = (await response.json().catch(() => ({}))) as CreateTenantInvitesResponse & {
    message?: string
    msg?: string
  }
  if (!response.ok) {
    data.error =
      data.error || data.message || data.msg || `Request failed (${response.status})`
  }
  return data
}

export function createTenantInvites(tenants: TenantInviteInput[]) {
  return postCreateTenantInvites({ tenants })
}

export function refreshTenantInvite(inviteId: string) {
  return postCreateTenantInvites({ refresh_invite_id: inviteId })
}

/** Staging App Links cannot verify www.sycnmore.com — use the custom scheme there. */
export function tenantInviteQrLink(result: {
  qr_link?: string
  app_link?: string
  https_link?: string
}): string {
  if (result.qr_link) return result.qr_link
  const staging = config.supabase.url.includes('qjxtyskldylgfnmolzmi')
  if (staging) return result.app_link || result.https_link || ''
  return result.https_link || result.app_link || ''
}
