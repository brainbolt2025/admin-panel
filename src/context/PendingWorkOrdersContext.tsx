import { createContext, useContext } from 'react'

export interface PendingWorkOrdersContextValue {
  pendingCount: number
  pendingTechniciansCount: number
  pendingTenantsCount: number
  refreshPendingCount: () => void
  refreshPendingTechniciansCount: () => void
  refreshPendingTenantsCount: () => void
}

const PendingWorkOrdersContext = createContext<PendingWorkOrdersContextValue | undefined>(undefined)

export const PendingWorkOrdersProvider = PendingWorkOrdersContext.Provider

export const usePendingWorkOrders = () => {
  const context = useContext(PendingWorkOrdersContext)

  if (!context) {
    throw new Error('usePendingWorkOrders must be used within a PendingWorkOrdersProvider')
  }

  return context
}
