import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bell, ClipboardList, Users, X } from 'lucide-react'
import { usePendingWorkOrders } from '../context/PendingWorkOrdersContext'
import { getAuthenticatedSupabase } from '../lib/supabase'
import {
  alertKeyForTenant,
  alertKeyForWorkOrder,
  getUnseenAlertKeys,
  markAlertsSeen,
  readSeenAlertKeys,
} from '../lib/alertSeenState'
import {
  fetchPendingAlerts,
  type PendingAlertUser,
  type PendingAlertWorkOrder,
  type PendingAlerts,
} from '../lib/pmQueries'

interface AlertsBellProps {
  onNavigateToWorkOrder: (workOrderId: string) => void
  onNavigateToTechnicians?: () => void
  onNavigateToTenants: () => void
  /** Optional className for the outer trigger row */
  className?: string
}

const emptyAlerts: PendingAlerts = {
  propertyId: null,
  workOrders: [],
  technicians: [],
  tenants: [],
}

const AlertsBell = ({
  onNavigateToWorkOrder,
  onNavigateToTenants,
  className = '',
}: AlertsBellProps) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alerts, setAlerts] = useState<PendingAlerts>(emptyAlerts)
  /** Keys highlighted as unread for the current open dialog session */
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set())
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set())
  const {
    acknowledgeWorkOrders,
    acknowledgeTenants,
  } = usePendingWorkOrders()

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPendingAlerts()
      setAlerts(data)
      setSeenKeys(readSeenAlertKeys(data.propertyId))
    } catch (err) {
      console.error('Error fetching pending alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 30000)
    return () => clearInterval(interval)
  }, [loadAlerts])

  const totalPending =
    alerts.workOrders.length + alerts.technicians.length + alerts.tenants.length

  const unreadKeys = useMemo(
    () => getUnseenAlertKeys(alerts, seenKeys),
    [alerts, seenKeys]
  )
  const unreadCount = unreadKeys.size

  const openAlerts = useCallback(async () => {
    setOpen(true)
    setLoading(true)
    try {
      const data = await fetchPendingAlerts()
      setAlerts(data)

      const previouslySeen = readSeenAlertKeys(data.propertyId)
      const newlyUnseen = getUnseenAlertKeys(data, previouslySeen)
      // Keep unread styling for this open session, then clear the badge
      setHighlightedKeys(newlyUnseen)

      const nowSeen = markAlertsSeen(data.propertyId, data)
      setSeenKeys(nowSeen)

      acknowledgeWorkOrders()
      acknowledgeTenants()
    } catch (err) {
      console.error('Error opening alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [acknowledgeWorkOrders, acknowledgeTenants])

  const handleBellClick = () => {
    if (open) {
      setOpen(false)
      setHighlightedKeys(new Set())
      return
    }
    void openAlerts()
  }

  const handleWorkOrderClick = async (workOrder: PendingAlertWorkOrder) => {
    try {
      const supabaseClient = getAuthenticatedSupabase()
      await supabaseClient
        .from('work_orders')
        .update({ seen_by_pm: true })
        .eq('id', workOrder.id)
    } catch (err) {
      console.error('Error marking work order as seen:', err)
    }

    setAlerts((prev) => ({
      ...prev,
      workOrders: prev.workOrders.filter((wo) => wo.id !== workOrder.id),
    }))
    setOpen(false)
    setHighlightedKeys(new Set())
    onNavigateToWorkOrder(workOrder.id)
  }

  const handleTenantClick = (_user: PendingAlertUser) => {
    setOpen(false)
    setHighlightedKeys(new Set())
    onNavigateToTenants()
  }

  const itemClassName = (isUnread: boolean) =>
    [
      'w-full text-left p-4 transition-colors border-b border-gray-100 last:border-b-0',
      isUnread
        ? 'bg-teal-50 hover:bg-teal-100/80 border-l-4 border-l-teal-500'
        : 'bg-white hover:bg-gray-50',
    ].join(' ')

  return (
    <div className={`flex items-center space-x-2 relative ${className}`}>
      <button
        type="button"
        onClick={handleBellClick}
        className="relative p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
        aria-label="Open alerts"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-teal-600 text-white text-[10px] font-semibold rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <span className="hidden sm:block text-sm font-medium text-gray-600">Alerts</span>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => {
              setOpen(false)
              setHighlightedKeys(new Set())
            }}
          />
          <div className="fixed top-16 right-6 w-96 bg-white rounded-xl shadow-lg z-50 max-h-[600px] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setHighlightedKeys(new Set())
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close alerts"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && totalPending === 0 ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Loading alerts...</p>
                </div>
              ) : totalPending === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No new notifications</p>
                </div>
              ) : (
                <div>
                  {alerts.workOrders.length > 0 && (
                    <AlertSection title="Work Orders" icon={<ClipboardList className="w-4 h-4 text-teal-600" />}>
                      {alerts.workOrders.map((workOrder) => {
                        const key = alertKeyForWorkOrder(workOrder.id)
                        const isUnread = highlightedKeys.has(key)
                        return (
                          <button
                            key={workOrder.id}
                            type="button"
                            className={itemClassName(isUnread)}
                            onClick={() => handleWorkOrderClick(workOrder)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                  {workOrder.title || 'Untitled Work Order'}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {workOrder.tenant_name && <span>{workOrder.tenant_name}</span>}
                                  {workOrder.tenant_name && workOrder.status && <span>•</span>}
                                  {workOrder.status && <span>{workOrder.status}</span>}
                                </div>
                              </div>
                              {isUnread && (
                                <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-teal-500" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </AlertSection>
                  )}

                  {alerts.tenants.length > 0 && (
                    <AlertSection title="Tenants" icon={<Users className="w-4 h-4 text-teal-600" />}>
                      {alerts.tenants.map((tenant) => {
                        const key = alertKeyForTenant(tenant.id)
                        const isUnread = highlightedKeys.has(key)
                        return (
                          <button
                            key={tenant.id}
                            type="button"
                            className={itemClassName(isUnread)}
                            onClick={() => handleTenantClick(tenant)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                  {tenant.name || 'Unnamed tenant'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {tenant.email || 'Pending approval'}
                                </p>
                              </div>
                              {isUnread && (
                                <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-teal-500" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </AlertSection>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AlertSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}

export default AlertsBell
