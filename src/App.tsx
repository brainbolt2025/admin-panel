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
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState('Dashboard')
  const [showInvitePM, setShowInvitePM] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null)
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [pendingWorkOrdersCount, setPendingWorkOrdersCount] = useState(0)
  const [pendingTechniciansCount, setPendingTechniciansCount] = useState(0)

  // Handle payment success redirect (just log, let Login component handle the UI)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sessionId = urlParams.get('session_id')
    const paymentStatus = urlParams.get('payment')
    
    if (paymentStatus === 'success' && sessionId) {
      console.log('App: Payment successful, session ID:', sessionId)
      // Don't clear URL parameters here - let Login component handle it
      // The Login component will show the success message and clear the params
    } else if (paymentStatus === 'cancelled') {
      console.log('App: Payment was cancelled')
      // Don't clear URL parameters here - let Login component handle it
    }
  }, [])

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
        .select('id, email, name, role, approved, property_id, property_name')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (profile) {
        setUserProfile(profile)
        syncLocalStorageUser(profile)
        return profile
      }

      setUserProfile(null)
      return null
    },
    [syncLocalStorageUser]
  )

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUserProfile(null)
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
  }, [fetchPendingWorkOrdersCount, fetchPendingTechniciansCount])

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

const pendingWorkOrdersContextValue = useMemo(
  () => ({
    pendingCount: pendingWorkOrdersCount,
    pendingTechniciansCount,
    setPendingCount: handlePendingCountChange,
    setPendingTechniciansCount: handlePendingTechniciansCountChange,
    refreshPendingCount: fetchPendingWorkOrdersCount,
    refreshPendingTechniciansCount: fetchPendingTechniciansCount,
  }),
  [
    pendingWorkOrdersCount,
    pendingTechniciansCount,
    handlePendingCountChange,
    handlePendingTechniciansCountChange,
    fetchPendingWorkOrdersCount,
    fetchPendingTechniciansCount,
  ],
)

  const handleNavigateToWorkOrder = (workOrderId: string) => {
    setSelectedWorkOrderId(workOrderId)
    setActiveItem('Work Orders')
  }

  const handleNavigateToTenant = (tenantName: string) => {
    setSelectedTenantFilter(tenantName)
    setActiveItem('Users')
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
      case 'Users':
        return <Users selectedTenantFilter={selectedTenantFilter} onClearTenantFilter={() => setSelectedTenantFilter(null)} />
      case 'Technicians':
        return <Technicians />
      case 'Approvals':
        return <Approvals />
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

  // Show subscription page (no authentication required)
  if (showSubscription) {
    return <Subscription onSuccess={handleSubscriptionSuccess} />
  }

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} onShowSubscription={() => setShowSubscription(true)} />
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
        
        <div className="flex-1 flex flex-col">
          <Topbar 
            onMenuToggle={toggleSidebar} 
            onNewPMAccount={handleNewPMAccount} 
            onLogout={handleLogout}
            onNavigateToWorkOrder={handleNavigateToWorkOrder}
          />
          <main className="flex-1">
            {renderContent()}
          </main>
        </div>
      </div>
    </PendingWorkOrdersProvider>
  )
}

export default App
