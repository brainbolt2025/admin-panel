import { createContext, useContext } from 'react'

export interface PendingWorkOrdersContextValue {
  pendingCount: number
  pendingTechniciansCount: number
  setPendingCount: (count: number) => void
  setPendingTechniciansCount: (count: number) => void
  refreshPendingCount: () => Promise<void>
  refreshPendingTechniciansCount: () => Promise<void>
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

