import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

export function invalidateWorkOrdersData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.workOrders })
  void queryClient.invalidateQueries({ queryKey: ['pendingIds', 'workOrders'] })
  void queryClient.refetchQueries({ queryKey: ['pendingIds', 'workOrders'] })
}

export function invalidateTechniciansData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.technicians })
  void queryClient.invalidateQueries({ queryKey: ['pendingIds', 'technicians'] })
  void queryClient.refetchQueries({ queryKey: ['pendingIds', 'technicians'] })
}

export function invalidateTenantsData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
  void queryClient.invalidateQueries({ queryKey: ['pendingIds', 'tenants'] })
  void queryClient.refetchQueries({ queryKey: ['pendingIds', 'tenants'] })
}

export function invalidateAllPmData(queryClient: QueryClient) {
  invalidateWorkOrdersData(queryClient)
  invalidateTechniciansData(queryClient)
  invalidateTenantsData(queryClient)
}
