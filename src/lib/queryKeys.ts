export const queryKeys = {
  technicians: ['technicians'] as const,
  tenants: ['tenants'] as const,
  workOrders: ['workOrders'] as const,
  currentUserName: ['currentUser', 'name'] as const,
  adminStats: ['adminStats'] as const,
  pendingWorkOrders: (propertyId: string | null | undefined) =>
    ['pendingCounts', 'workOrders', propertyId ?? 'none'] as const,
  pendingTechnicians: (propertyId: string | null | undefined) =>
    ['pendingCounts', 'technicians', propertyId ?? 'none'] as const,
  pendingTenants: (propertyId: string | null | undefined) =>
    ['pendingCounts', 'tenants', propertyId ?? 'none'] as const,
}
