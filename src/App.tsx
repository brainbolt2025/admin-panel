import { useState, useEffect, useCallback, useMemo } from 'react'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './components/Dashboard'
import PropertyManagers from './components/PropertyManagers'
import InvitePM from './components/InvitePM'
import Subscription from './components/Subscription'
import WorkOrders from './components/WorkOrders'
import Users from './components/Users'
import Technicians from './components/Technicians'
import Approvals from './components/Approvals'
import Profile from './components/Profile'
import SubscriptionCancellationBanner from './components/SubscriptionCancellationBanner'
import RenewSubscription from './components/RenewSubscription'
import EmailVerificationBanner from './components/EmailVerificationBanner'
import { getAuthenticatedSupabase, supabase } from './lib/supabase'
import { PendingWorkOrdersProvider } from './context/PendingWorkOrdersContext'

interface UserProfile {
  id: string
  email: string | null
  name: string | null
  role: string | null
  approved: boolean | null
  property_id?: string | null
  property_name?: string | null
  email_verified?: boolean | null
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState('Dashboard')
  const [showInvitePM, setShowInvitePM] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [showRenewSubscription, setShowRenewSubscription] = useState(false)
  const [subscriptionPrefill, setSubscriptionPrefill] = useState({
    name: '',
    email: '',
    propertyName: '',
  })

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.pathname.includes('/subscribe')) {
        setSubscriptionPrefill({
          name: url.searchParams.get('name') ?? '',
          email: url.searchParams.get('email') ?? '',
          propertyName: url.searchParams.get('property') ?? '',
        })
        setShowSubscription(true)

        if (window.history.replaceState) {
          window.history.replaceState(null, '', `${url.origin}${url.pathname}`)
        }
      }
    } catch (error) {
      console.error('Failed to parse URL for subscription prefill:', error)
    }
  }, [])
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null)
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [cancelAt, setCancelAt] = useState<string | null>(null)
  const [pendingWorkOrdersCount, setPendingWorkOrdersCount] = useState(0)
  const [pendingTechniciansCount, setPendingTechniciansCount] = useState(0)
  const [pendingTenantsCount, setPendingTenantsCount] = useState(0)
  const [refreshWorkOrdersList, setRefreshWorkOrdersList] = useState<(() => Promise<void>) | null>(null)


  const syncLocalStorageUser = useCallback((profile: UserProfile | null) => {
    if (!profile) return

    try {
      const userStr = localStorage.getItem('user')
      if (!userStr) return

      const userData = JSON.parse(userStr)
      const mergedUser = {
        ...userData,
        approved: profile.approved,
        profile,
      }

      localStorage.setItem('user', JSON.stringify(mergedUser))
    } catch (error) {
      console.error('Failed to sync user profile to localStorage:', error)
    }
  }, [])

  const loadUserProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      if (!userId) {
        return null
      }

      const supabaseClient = getAuthenticatedSupabase()
      const { data: profile, error } = await supabaseClient
        .from('users')
        .select('id, email, name, role, approved, property_id, property_name, cancel_at, subscription_status, subscribed, email_verified')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (profile) {
        setUserProfile(profile)
        setCancelAt(profile.cancel_at || null)
        syncLocalStorageUser(profile)
        
        // Check if subscription is cancelled or expired - show renewal page if:
        // 1. Subscription status is 'canceled' and subscribed is false (no active subscription)
        // 2. OR subscription is 'canceled' and cancel_at date has passed
        if (profile.role === 'pm') {
          const hasActiveSubscription = profile.subscribed === true && profile.subscription_status === 'active'
          const isCancelled = profile.subscription_status === 'canceled'
          const hasCancelDate = profile.cancel_at !== null
          
          if (isCancelled && !hasActiveSubscription) {
            if (hasCancelDate) {
              // Check if cancel_at date has passed
              const cancelDate = new Date(profile.cancel_at)
              const now = new Date()
              if (now >= cancelDate) {
                setShowRenewSubscription(true)
              }
            } else {
              // No cancel_at date means subscription was cancelled immediately or manually deleted
              // Show renewal page if no active subscription
              setShowRenewSubscription(true)
            }
          }
        }
        
        return profile
      }

      setUserProfile(null)
      setCancelAt(null)
      return null
    },
    [syncLocalStorageUser]
  )

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUserProfile(null)
    setCancelAt(null)
  }, [])

  const fetchPendingWorkOrdersCount = useCallback(async () => {
    if (!userProfile || userProfile.role !== 'pm') {
      setPendingWorkOrdersCount(0)
      return
    }

    try {
      const supabaseClient = getAuthenticatedSupabase()
      let query = supabaseClient
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Pending')

      if (userProfile.property_id) {
        query = query.eq('property_id', userProfile.property_id)
      }

      const { count, error } = await query

      if (error) {
        throw error
      }

      setPendingWorkOrdersCount(count ?? 0)
    } catch (error) {
      console.error('Failed to fetch pending work orders count:', error)
    }
  }, [userProfile])

  const fetchPendingTechniciansCount = useCallback(async () => {
    if (!userProfile || userProfile.role !== 'pm') {
      setPendingTechniciansCount(0)
      return
    }

    try {
      const supabaseClient = getAuthenticatedSupabase()
      let query = supabaseClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'technician')
        .eq('approved', false)

      if (userProfile.property_id) {
        query = query.eq('property_id', userProfile.property_id)
      }

      const { count, error } = await query

      if (error) {
        throw error
      }

      setPendingTechniciansCount(count ?? 0)
    } catch (error) {
      console.error('Failed to fetch pending technicians count:', error)
    }
  }, [userProfile])

  const fetchPendingTenantsCount = useCallback(async () => {
    if (!userProfile || userProfile.role !== 'pm') {
      setPendingTenantsCount(0)
      return
    }

    try {
      const supabaseClient = getAuthenticatedSupabase()
      let query = supabaseClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'tenant')
        .eq('approved', false)

      if (userProfile.property_id) {
        query = query.eq('property_id', userProfile.property_id)
      }

      const { count, error } = await query

      if (error) {
        throw error
      }

      setPendingTenantsCount(count ?? 0)
    } catch (error) {
      console.error('Failed to fetch pending tenants count:', error)
    }
  }, [userProfile])

  // Keep tokens in sync with Supabase session changes and refresh automatically
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        localStorage.setItem('access_token', session.access_token)
        if (session.refresh_token) {
          localStorage.setItem('refresh_token', session.refresh_token)
        }
        localStorage.setItem('user', JSON.stringify(session.user))
        setIsLoggedIn(true)
        loadUserProfile(session.user.id).catch((error) => {
          console.error('Failed to load user profile after auth change:', error)
        })
      } else {
        clearStoredSession()
        setIsLoggedIn(false)
      }

      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setIsCheckingAuth(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadUserProfile, clearStoredSession])

  // Handle payment success redirect (must be after loadUserProfile is defined)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sessionId = urlParams.get('session_id')
    const paymentStatus = urlParams.get('payment')
    const isRenewal = urlParams.get('renewal') === 'true'
    
    if (paymentStatus === 'success' && sessionId) {
      console.log('App: Payment successful, session ID:', sessionId, 'Renewal:', isRenewal)
      
      // If this is a renewal and user is logged in, reload profile to update subscription status
      if (isRenewal && userProfile?.id) {
        loadUserProfile(userProfile.id).catch(console.error)
        // Clear URL parameters
        if (window.history.replaceState) {
          const url = new URL(window.location.href)
          url.searchParams.delete('session_id')
          url.searchParams.delete('payment')
          url.searchParams.delete('renewal')
          window.history.replaceState({}, document.title, url.toString())
        }
      }
      // For non-renewal payments, let Login component handle it
    } else if (paymentStatus === 'cancelled') {
      console.log('App: Payment was cancelled')
      // Clear URL parameters
      if (window.history.replaceState) {
        const url = new URL(window.location.href)
        url.searchParams.delete('payment')
        url.searchParams.delete('renewal')
        window.history.replaceState({}, document.title, url.toString())
      }
    }
  }, [userProfile, loadUserProfile])

  // Initialize auth state on first load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          setIsLoggedIn(true)
          await loadUserProfile(session.user.id)
        } else {
          // Fall back to legacy stored tokens if available
          const storedAccessToken = localStorage.getItem('access_token')
          const storedRefreshToken = localStorage.getItem('refresh_token')

          if (storedAccessToken && storedRefreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: storedAccessToken,
              refresh_token: storedRefreshToken,
            })

            if (!error && data.session) {
              setIsLoggedIn(true)
              await loadUserProfile(data.session.user.id)
              setIsCheckingAuth(false)
              return
            }
          }

          clearStoredSession()
          setIsLoggedIn(false)
        }
      } catch (error) {
        console.error('Failed to initialize auth session:', error)
        clearStoredSession()
        setIsLoggedIn(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    initializeAuth()
  }, [loadUserProfile, clearStoredSession])

  useEffect(() => {
    fetchPendingWorkOrdersCount()
    fetchPendingTechniciansCount()
    fetchPendingTenantsCount()
  }, [fetchPendingWorkOrdersCount, fetchPendingTechniciansCount, fetchPendingTenantsCount])

  // Set up polling for pending counts (updates every 30 seconds)
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'pm' || !userProfile.property_id) {
      return
    }

    // Poll every 30 seconds to check for updates
    // COMMENTED OUT FOR TESTING REAL-TIME SUBSCRIPTIONS
    // const pollInterval = setInterval(() => {
    //   fetchPendingWorkOrdersCount()
    //   fetchPendingTechniciansCount()
    //   // Also refresh the work orders list if available
    //   if (refreshWorkOrdersList) {
    //     refreshWorkOrdersList().catch((error) => {
    //       console.error('Error refreshing work orders list:', error)
    //     })
    //   }
    // }, 30000) // 30 seconds

    // Set up real-time subscriptions
    const supabaseClient = getAuthenticatedSupabase()

    // Try to subscribe to work_orders table changes (if real-time is enabled)
    const workOrdersChannel = supabaseClient
      .channel('pending_work_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_orders',
          filter: `property_id=eq.${userProfile.property_id}`,
        },
        (payload) => {
          console.log('Work order changed, refreshing count:', payload.eventType)
          fetchPendingWorkOrdersCount()
          // Also refresh the work orders list if available
          if (refreshWorkOrdersList) {
            refreshWorkOrdersList().catch((error) => {
              console.error('Error refreshing work orders list:', error)
            })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active for work orders')
        } else if (status === 'CHANNEL_ERROR') {
          console.log('Real-time not available, using polling only')
        }
      })

    // Try to subscribe to users table changes (if real-time is enabled)
    const techniciansChannel = supabaseClient
      .channel('pending_technicians_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `property_id=eq.${userProfile.property_id}`,
        },
        (payload) => {
          const newRecord = payload.new as any
          const oldRecord = payload.old as any
          
          const isTechnicianChange =
            (newRecord?.role === 'technician' || oldRecord?.role === 'technician') ||
            (newRecord?.approved !== undefined || oldRecord?.approved !== undefined)

          const isTenantChange =
            (newRecord?.role === 'tenant' || oldRecord?.role === 'tenant') ||
            (newRecord?.approved !== undefined || oldRecord?.approved !== undefined)

          if (isTechnicianChange) {
            console.log('Technician changed, refreshing count:', payload.eventType)
            fetchPendingTechniciansCount()
          }

          if (isTenantChange) {
            console.log('Tenant changed, refreshing count:', payload.eventType)
            fetchPendingTenantsCount()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active for technicians and tenants')
        } else if (status === 'CHANNEL_ERROR') {
          console.log('Real-time not available, using polling only')
        }
      })

    // Subscribe to current user's changes (cancel_at, subscription_status, email_verified)
    const userUpdatesChannel = supabaseClient
      .channel('user_updates_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userProfile.id}`,
        },
        (payload) => {
          const newRecord = payload.new as any
          
          // Update cancel_at if changed
          if (newRecord?.cancel_at !== undefined) {
            console.log('User cancellation status changed, updating cancel_at')
            setCancelAt(newRecord.cancel_at || null)
          }
          
          // Update email_verified if changed (triggers re-render of banner)
          if (newRecord?.email_verified !== undefined) {
            console.log('User email verification status changed, updating userProfile')
            setUserProfile((prev) => prev ? { ...prev, email_verified: newRecord.email_verified } : null)
          }
          
          // Check if subscription is cancelled or expired - show renewal page if needed
          if (userProfile?.role === 'pm') {
            const hasActiveSubscription = newRecord?.subscribed === true && newRecord?.subscription_status === 'active'
            const isCancelled = newRecord?.subscription_status === 'canceled'
            const hasCancelDate = newRecord?.cancel_at !== null
            
            if (isCancelled && !hasActiveSubscription) {
              if (hasCancelDate) {
                // Check if cancel_at date has passed
                const cancelDate = new Date(newRecord.cancel_at)
                const now = new Date()
                if (now >= cancelDate) {
                  setShowRenewSubscription(true)
                }
              } else {
                // No cancel_at date means subscription was cancelled immediately or manually deleted
                setShowRenewSubscription(true)
              }
            } else if (hasActiveSubscription || newRecord?.subscription_status === 'active') {
              setShowRenewSubscription(false)
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active for user updates')
        } else if (status === 'CHANNEL_ERROR') {
          console.log('Real-time not available for user updates')
        }
      })

    // Cleanup on unmount or when dependencies change
    return () => {
      // clearInterval(pollInterval) // COMMENTED OUT - polling disabled for testing
      supabaseClient.removeChannel(workOrdersChannel)
      supabaseClient.removeChannel(techniciansChannel)
      supabaseClient.removeChannel(userUpdatesChannel)
    }
  }, [userProfile, fetchPendingWorkOrdersCount, fetchPendingTechniciansCount, fetchPendingTenantsCount, refreshWorkOrdersList])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const handleNewPMAccount = () => {
    setShowInvitePM(true)
  }

  const handleBackFromInvitePM = () => {
    setShowInvitePM(false)
  }

  const handleSubscriptionSuccess = () => {
    setShowSubscription(false)
    setIsLoggedIn(true)
  }

  const handleLogin = () => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      if (session?.user?.id) {
        loadUserProfile(session.user.id).catch((error) => {
          console.error('Failed to load user profile after login:', error)
        })
      }
    })
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      clearStoredSession()
      setIsLoggedIn(false)
    } catch (error) {
      console.error('Logout error:', error)
      // Clear tokens and redirect even on error
      clearStoredSession()
      setIsLoggedIn(false)
    }
  }

const handlePendingCountChange = useCallback(
  (count: number) => {
    if (userProfile?.role === 'pm') {
      setPendingWorkOrdersCount(count)
    }
  },
  [userProfile],
)

const handlePendingTechniciansCountChange = useCallback(
  (count: number) => {
    if (userProfile?.role === 'pm') {
      setPendingTechniciansCount(count)
    }
  },
  [userProfile],
)

const handlePendingTenantsCountChange = useCallback(
  (count: number) => {
    if (userProfile?.role === 'pm') {
      setPendingTenantsCount(count)
    }
  },
  [userProfile],
)

const pendingWorkOrdersContextValue = useMemo(
  () => ({
    pendingCount: pendingWorkOrdersCount,
    pendingTechniciansCount,
    pendingTenantsCount,
    setPendingCount: handlePendingCountChange,
    setPendingTechniciansCount: handlePendingTechniciansCountChange,
    setPendingTenantsCount: handlePendingTenantsCountChange,
    refreshPendingCount: fetchPendingWorkOrdersCount,
    refreshPendingTechniciansCount: fetchPendingTechniciansCount,
    refreshPendingTenantsCount: fetchPendingTenantsCount,
    refreshWorkOrdersList,
    setRefreshWorkOrdersList,
  }),
  [
    pendingWorkOrdersCount,
    pendingTechniciansCount,
    pendingTenantsCount,
    handlePendingCountChange,
    handlePendingTechniciansCountChange,
    handlePendingTenantsCountChange,
    fetchPendingWorkOrdersCount,
    fetchPendingTechniciansCount,
    fetchPendingTenantsCount,
    refreshWorkOrdersList,
  ],
)

  const handleNavigateToWorkOrder = (workOrderId: string) => {
    setSelectedWorkOrderId(workOrderId)
    setActiveItem('Work Orders')
  }

  const handleNavigateToTenant = (tenantName: string) => {
    setSelectedTenantFilter(tenantName)
    setActiveItem('Tenants')
  }

  const renderContent = () => {
    if (showInvitePM) {
      return <InvitePM onBack={handleBackFromInvitePM} />
    }

    switch (activeItem) {
      case 'Dashboard':
        return <Dashboard onNavigateToTenant={handleNavigateToTenant} onNavigateToWorkOrder={handleNavigateToWorkOrder} />
      case 'PM Accounts':
        return <PropertyManagers />
      case 'Work Orders':
        return <WorkOrders selectedWorkOrderId={selectedWorkOrderId} onClearSelectedWorkOrder={() => setSelectedWorkOrderId(null)} />
      case 'Tenants':
        return <Users selectedTenantFilter={selectedTenantFilter} onClearTenantFilter={() => setSelectedTenantFilter(null)} />
      case 'Technicians':
        return <Technicians />
      case 'Approvals':
        return <Approvals />
      case 'Profile':
        return <Profile onLogout={handleLogout} />
      default:
        return <Dashboard onNavigateToTenant={handleNavigateToTenant} onNavigateToWorkOrder={handleNavigateToWorkOrder} />
    }
  }

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Show renew subscription page (for cancelled subscriptions)
  if (showRenewSubscription && userProfile?.role === 'pm') {
    return (
      <RenewSubscription
        onSuccess={() => {
          setShowRenewSubscription(false)
          // Reload user profile to refresh subscription status
          if (userProfile?.id) {
            loadUserProfile(userProfile.id).catch(console.error)
          }
        }}
        onLogout={handleLogout}
      />
    )
  }

  // Show subscription page (no authentication required)
  if (showSubscription) {
    return (
      <Subscription
        onSuccess={handleSubscriptionSuccess}
        initialName={subscriptionPrefill.name}
        initialEmail={subscriptionPrefill.email}
        initialPropertyName={subscriptionPrefill.propertyName}
      />
    )
  }

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return (
      <Login
        onLogin={handleLogin}
        onShowSubscription={() => {
          setSubscriptionPrefill({
            name: '',
            email: '',
            propertyName: '',
          })
          setShowSubscription(true)
        }}
      />
    )
  }

  return (
    <PendingWorkOrdersProvider value={pendingWorkOrdersContextValue}>
      <div className="min-h-screen bg-gray-100 flex">
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={toggleSidebar} 
          activeItem={activeItem}
          onActiveItemChange={setActiveItem}
        />
        
        <div className="flex-1 flex flex-col lg:ml-64">
          {!['Dashboard', 'Work Orders', 'Tenants', 'Technicians', 'Profile'].includes(activeItem) && (
            <Topbar 
              onMenuToggle={toggleSidebar} 
              onNewPMAccount={handleNewPMAccount} 
              onLogout={handleLogout}
              onNavigateToWorkOrder={handleNavigateToWorkOrder}
            />
          )}
          {userProfile?.role === 'pm' && (
            <>
              <SubscriptionCancellationBanner cancelAt={cancelAt} />
              {userProfile.email_verified === false && (
                <EmailVerificationBanner 
                  email={userProfile.email} 
                  emailVerified={userProfile.email_verified === true}
                  userName={userProfile.name}
                  userId={userProfile.id}
                />
              )}
            </>
          )}
          <main className="flex-1">
            {renderContent()}
          </main>
        </div>
      </div>
    </PendingWorkOrdersProvider>
  )
}

export default App
