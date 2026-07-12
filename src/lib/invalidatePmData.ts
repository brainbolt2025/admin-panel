import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

export function invalidateWorkOrdersData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.workOrders })
  queryClient.invalidateQueries({ queryKey: ['pendingCounts', 'workOrders'] })
}

export function invalidateTechniciansData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.technicians })
  queryClient.invalidateQueries({ queryKey: ['pendingCounts', 'technicians'] })
}

export function invalidateTenantsData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
  queryClient.invalidateQueries({ queryKey: ['pendingCounts', 'tenants'] })
}

export function invalidateAllPmData(queryClient: QueryClient) {
  invalidateWorkOrdersData(queryClient)
  invalidateTechniciansData(queryClient)
  invalidateTenantsData(queryClient)
}
