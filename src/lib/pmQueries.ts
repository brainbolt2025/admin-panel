import { getAuthenticatedSupabase } from './supabase'
import { APPROVAL_STATUS, normalizeApprovalStatus, type ApprovalStatus } from './approvalStatus'

const PROFILE_PICTURES_BUCKET = 'profile-pictures'

export interface PmTechnician {
  id: string
  name: string | null
  email: string | null
  role: string | null
  approved: ApprovalStatus
  created_at?: string
  profile_picture_url?: string | null
  property_name?: string | null
  email_verified?: boolean | null
}

export interface PmTenant {
  id: string
  name: string | null
  email: string | null
  role: string | null
  approved: ApprovalStatus
  created_at?: string
  profile_picture_url?: string | null
  unit_number?: string | null
  property_name?: string | null
  email_verified?: boolean | null
}

export interface PmWorkOrder {
  id: string
  title: string | null
  description: string | null
  priority: 'Low' | 'Medium' | 'High' | null
  status: string | null
  property_name?: string
  tenant_name?: string
  tenant_id?: string
  property_id?: string
  technician_id?: string
  unit_number?: string | null
  created_at?: string | null
}

export interface TechniciansQueryResult {
  technicians: PmTechnician[]
  profilePictureUrls: Record<string, string>
}

export interface TenantsQueryResult {
  tenants: PmTenant[]
  profilePictureUrls: Record<string, string>
}

async function getPmPropertyId(): Promise<string | null> {
  const supabaseClient = getAuthenticatedSupabase()
  const { data: userData } = await supabaseClient.auth.getUser()

  if (!userData.user) {
    throw new Error('User not found')
  }

  const { data: pmData, error: pmError } = await supabaseClient
    .from('users')
    .select('property_id')
    .eq('id', userData.user.id)
    .eq('role', 'pm')
    .maybeSingle()

  // No PM profile row — treat as no property (empty lists) instead of a hard error
  if (pmError) {
    if (pmError.code === 'PGRST116') return null
    throw pmError
  }

  return pmData?.property_id ?? null
}

async function fetchProfilePictureUrls(
  users: Array<{ id: string; profile_picture_url?: string | null }>
): Promise<Record<string, string>> {
  const supabaseClient = getAuthenticatedSupabase()
  const urlsMap: Record<string, string> = {}

  await Promise.all(
    users
      .filter((user) => user.profile_picture_url)
      .map(async (user) => {
        try {
          const { data: signedData, error: signedError } = await supabaseClient.storage
            .from(PROFILE_PICTURES_BUCKET)
            .createSignedUrl(user.profile_picture_url!, 60 * 60 * 24)

          if (!signedError && signedData?.signedUrl) {
            urlsMap[user.id] = signedData.signedUrl
          }
        } catch (err) {
          console.error(`Error fetching profile picture for user ${user.id}:`, err)
        }
      })
  )

  return urlsMap
}

export async function fetchTechniciansQuery(): Promise<TechniciansQueryResult> {
  const supabaseClient = getAuthenticatedSupabase()
  const propertyId = await getPmPropertyId()

  if (!propertyId) {
    return { technicians: [], profilePictureUrls: {} }
  }

  const { data: techniciansData, error: techniciansError } = await supabaseClient
    .from('users')
    .select('id, name, email, role, approved, created_at, profile_picture_url, property_name, email_verified')
    .eq('property_id', propertyId)
    .eq('role', 'technician')
    .order('created_at', { ascending: false })

  if (techniciansError) throw techniciansError

  const technicians: PmTechnician[] = (techniciansData ?? []).map((technician) => ({
    id: technician.id,
    name: technician.name,
    email: technician.email,
    role: technician.role,
    approved: normalizeApprovalStatus(technician.approved),
    created_at: technician.created_at,
    profile_picture_url: technician.profile_picture_url,
    property_name: technician.property_name,
    email_verified: technician.email_verified,
  }))

  const profilePictureUrls = await fetchProfilePictureUrls(technicians)
  return { technicians, profilePictureUrls }
}

export async function fetchTenantsQuery(): Promise<TenantsQueryResult> {
  const supabaseClient = getAuthenticatedSupabase()
  const propertyId = await getPmPropertyId()

  if (!propertyId) {
    return { tenants: [], profilePictureUrls: {} }
  }

  const { data: tenantsData, error: tenantsError } = await supabaseClient
    .from('users')
    .select('id, name, email, role, approved, created_at, profile_picture_url, unit_number, property_name, email_verified')
    .eq('property_id', propertyId)
    .eq('role', 'tenant')
    .order('created_at', { ascending: false })

  if (tenantsError) throw tenantsError

  const tenants: PmTenant[] = (tenantsData ?? []).map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    email: tenant.email,
    role: tenant.role,
    approved: normalizeApprovalStatus(tenant.approved),
    created_at: tenant.created_at,
    profile_picture_url: tenant.profile_picture_url,
    unit_number: tenant.unit_number,
    property_name: tenant.property_name,
    email_verified: tenant.email_verified,
  }))

  const profilePictureUrls = await fetchProfilePictureUrls(tenants)
  return { tenants, profilePictureUrls }
}

function transformWorkOrders(ordersData: any[]): PmWorkOrder[] {
  return ordersData.map((order: any) => {
    let tenantName = 'N/A'

    if (order.tenant?.name) {
      tenantName = order.tenant.name
    } else if (order.tenant_name) {
      tenantName = order.tenant_name
    }

    return {
      id: order.id,
      title: order.title || order.description || 'Untitled',
      description: order.description,
      priority: order.priority as 'Low' | 'Medium' | 'High' | null,
      status: order.status,
      tenant_name: tenantName,
      tenant_id: order.tenant_id,
      property_id: order.property_id,
      technician_id: order.technician_id,
      unit_number: order.unit_number || null,
      created_at: order.created_at || null,
    }
  })
}

export async function fetchWorkOrdersQuery(): Promise<PmWorkOrder[]> {
  const supabaseClient = getAuthenticatedSupabase()

  // Avoid PostgREST embeds on users — tenant_id FK may be missing from schema cache.
  // Prefer denormalized tenant_name; resolve names in a follow-up query when needed.
  const { data: ordersData, error: ordersError } = await supabaseClient
    .from('work_orders')
    .select(`
      id,
      title,
      description,
      priority,
      status,
      tenant_name,
      tenant_id,
      property_id,
      technician_id,
      unit_number,
      created_at
    `)
    .order('id', { ascending: false })

  if (ordersError) throw ordersError
  if (!ordersData || ordersData.length === 0) return []

  const missingTenantIds = [
    ...new Set(
      ordersData
        .filter((order) => !order.tenant_name && order.tenant_id)
        .map((order) => order.tenant_id as string)
    ),
  ]

  let tenantNamesById: Record<string, string> = {}
  if (missingTenantIds.length > 0) {
    const { data: tenants, error: tenantsError } = await supabaseClient
      .from('users')
      .select('id, name')
      .in('id', missingTenantIds)

    if (tenantsError) {
      console.error('Failed to resolve tenant names for work orders:', tenantsError)
    } else {
      tenantNamesById = Object.fromEntries(
        (tenants ?? []).map((tenant) => [tenant.id, tenant.name || 'N/A'])
      )
    }
  }

  const enriched = ordersData.map((order) => ({
    ...order,
    tenant_name:
      order.tenant_name ||
      (order.tenant_id ? tenantNamesById[order.tenant_id] : null) ||
      null,
  }))

  return transformWorkOrders(enriched)
}

export async function fetchPendingWorkOrderIds(
  propertyId: string | null | undefined
): Promise<string[]> {
  if (!propertyId) return []

  const supabaseClient = getAuthenticatedSupabase()
  const { data, error } = await supabaseClient
    .from('work_orders')
    .select('id')
    .eq('status', 'Pending')
    .eq('property_id', propertyId)

  if (error) throw error
  return (data ?? []).map((row) => row.id).filter(Boolean)
}

export async function fetchPendingTechnicianIds(
  propertyId: string | null | undefined
): Promise<string[]> {
  if (!propertyId) return []

  const supabaseClient = getAuthenticatedSupabase()
  const { data, error } = await supabaseClient
    .from('users')
    .select('id')
    .eq('role', 'technician')
    .eq('approved', APPROVAL_STATUS.pending)
    .eq('property_id', propertyId)

  if (error) throw error
  return (data ?? []).map((row) => row.id).filter(Boolean)
}

export async function fetchPendingTenantIds(
  propertyId: string | null | undefined
): Promise<string[]> {
  if (!propertyId) return []

  const supabaseClient = getAuthenticatedSupabase()
  const { data, error } = await supabaseClient
    .from('users')
    .select('id')
    .eq('role', 'tenant')
    .eq('approved', APPROVAL_STATUS.pending)
    .eq('property_id', propertyId)

  if (error) throw error
  return (data ?? []).map((row) => row.id).filter(Boolean)
}

export interface PendingAlertWorkOrder {
  id: string
  title: string | null
  tenant_name: string | null
  status: string | null
  created_at?: string | null
}

export interface PendingAlertUser {
  id: string
  name: string | null
  email: string | null
  created_at?: string | null
}

export interface PendingAlerts {
  propertyId: string | null
  workOrders: PendingAlertWorkOrder[]
  technicians: PendingAlertUser[]
  tenants: PendingAlertUser[]
}

/** Lists pending WO / tech / tenant items for the PM Alerts dialog. */
export async function fetchPendingAlerts(): Promise<PendingAlerts> {
  const propertyId = await getPmPropertyId()
  if (!propertyId) {
    return { propertyId: null, workOrders: [], technicians: [], tenants: [] }
  }

  const supabaseClient = getAuthenticatedSupabase()

  const [workOrdersResult, tenantsResult] = await Promise.all([
    supabaseClient
      .from('work_orders')
      .select('id, title, tenant_name, status, created_at')
      .eq('property_id', propertyId)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false }),
    supabaseClient
      .from('users')
      .select('id, name, email, created_at')
      .eq('property_id', propertyId)
      .eq('role', 'tenant')
      .eq('approved', APPROVAL_STATUS.pending)
      .order('created_at', { ascending: false }),
  ])

  if (workOrdersResult.error) throw workOrdersResult.error
  if (tenantsResult.error) throw tenantsResult.error

  return {
    propertyId,
    workOrders: (workOrdersResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      tenant_name: row.tenant_name,
      status: row.status,
      created_at: row.created_at,
    })),
    // Technicians are auto-approved on invite — no pending-approval alerts
    technicians: [],
    tenants: tenantsResult.data ?? [],
  }
}

export async function fetchCurrentUserName(): Promise<string> {
  try {
    const supabaseClient = getAuthenticatedSupabase()
    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) return 'Admin'

    const { data: profile } = await supabaseClient
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single()

    if (profile?.name) return profile.name
    return user.email?.split('@')[0] || 'Admin'
  } catch (error) {
    console.error('Error fetching user name:', error)
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        return (
          user.user_metadata?.name ||
          user.raw_user_meta_data?.name ||
          user.email?.split('@')[0] ||
          'Admin'
        )
      }
    } catch {
      // ignore
    }
    return 'Admin'
  }
}

export interface AdminStatsResult {
  activePMs: number
  assignedProperties: number
}

export async function fetchAdminStatsQuery(): Promise<AdminStatsResult> {
  const supabaseClient = getAuthenticatedSupabase()

  const [{ count: pmCount, error: pmError }, { count: propertyCount, error: propertyError }] =
    await Promise.all([
      supabaseClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'pm'),
      supabaseClient
        .from('properties')
        .select('id', { count: 'exact', head: true }),
    ])

  if (pmError) throw pmError
  if (propertyError) throw propertyError

  return {
    activePMs: pmCount ?? 0,
    assignedProperties: propertyCount ?? 0,
  }
}

export interface PmWorkOrderStats {
  pending: number
  inProgress: number
  completed: number
}

export function derivePmWorkOrderStats(workOrders: PmWorkOrder[]): PmWorkOrderStats {
  return {
    pending: workOrders.filter((order) => order.status === 'Pending').length,
    inProgress: workOrders.filter((order) => order.status === 'In Progress').length,
    completed: workOrders.filter((order) => order.status === 'Completed').length,
  }
}
