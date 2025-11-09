import { createContext, useContext } from 'react'

export interface PendingWorkOrdersContextValue {
  pendingCount: number
  setPendingCount: (count: number) => void
  refreshPendingCount: () => Promise<void>
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

