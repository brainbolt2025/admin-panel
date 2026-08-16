export const queryKeys = {
  technicians: ['technicians'] as const,
  tenants: ['tenants'] as const,
  workOrders: ['workOrders'] as const,
  reports: ['reports'] as const,
  currentUserName: ['currentUser', 'name'] as const,
  adminStats: ['adminStats'] as const,
  pendingWorkOrders: (propertyId: string | null | undefined) =>
    ['pendingIds', 'workOrders', propertyId ?? 'none'] as const,
  pendingTechnicians: (propertyId: string | null | undefined) =>
    ['pendingIds', 'technicians', propertyId ?? 'none'] as const,
  pendingTenants: (propertyId: string | null | undefined) =>
    ['pendingIds', 'tenants', propertyId ?? 'none'] as const,
  pendingReports: (propertyId: string | null | undefined) =>
    ['pendingIds', 'reports', propertyId ?? 'none'] as const,
}
