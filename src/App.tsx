import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import Waitlist from './components/Waitlist'
import ResetPassword from './components/ResetPassword'
import { getAuthenticatedSupabase, supabase, isPasswordRecoveryLanding } from './lib/supabase'
import { PendingWorkOrdersProvider } from './context/PendingWorkOrdersContext'
import { queryKeys } from './lib/queryKeys'
import {
  fetchPendingWorkOrdersCount,
  fetchPendingTechniciansCount,
  fetchPendingTenantsCount,
} from './lib/pmQueries'
import {
  invalidateTechniciansData,
  invalidateTenantsData,
  invalidateWorkOrdersData,
} from './lib/invalidatePmData'
import { normalizeApprovalStatus, type ApprovalStatus } from './lib/approvalStatus'
import { usePendingAcknowledgment } from './lib/usePendingAcknowledgment'
import {
  clearPendingPmSignupCredentials,
  readPendingPmSignupCredentials,
  setPmSignupLoginHint,
} from './lib/pendingPmSignup'
import { isAdminPanelRole, markAdminPanelAccessDenied } from './lib/adminRoles'
import { config } from './config'

function isNewPmSignupPaymentReturn(): boolean {
  const params = new URLSearchParams(window.location.search)
  return (
    params.get('payment') === 'success' &&
    !!params.get('session_id') &&
    params.get('renewal') !== 'true'
  )
}

interface UserProfile {
  id: string
  email: string | null
  name: string | null
  role: string | null
  approved: ApprovalStatus
  property_id?: string | null
  property_name?: string | null
  email_verified?: boolean | null
  subscription_status?: string | null
  subscribed?: boolean | null
  cancel_at?: string | null
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isFinalizingSignupPayment, setIsFinalizingSignupPayment] = useState(() =>
    isNewPmSignupPaymentReturn()
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState('Dashboard')
  const [showInvitePM, setShowInvitePM] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [showRenewSubscription, setShowRenewSubscription] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const paymentPollStartedRef = useRef(false)
  const signupPaymentReturnRef = useRef(isNewPmSignupPaymentReturn())
  const emailVerificationHandledRef = useRef(false)
  const [emailVerificationNotice, setEmailVerificationNotice] = useState<{
    type: 'success' | 'error' | 'pending'
    text: string
  } | null>(null)
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

  // Detect a password-recovery landing (from the reset-password email link).
  // `isPasswordRecoveryLanding` is captured in supabase.ts *before* the client
  // consumes and clears the recovery hash, so this works whether the email
  // redirects to "/reset-password" or to the bare site root.
  useEffect(() => {
    try {
      const isRecoveryPath = window.location.pathname.includes('/reset-password')
      const searchParams = new URLSearchParams(window.location.search)
      const hashType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type')
      const isRecovery =
        isPasswordRecoveryLanding ||
        isRecoveryPath ||
        searchParams.get('type') === 'recovery' ||
        hashType === 'recovery'

      if (isRecovery) {
        setShowResetPassword(true)
        setIsCheckingAuth(false)
      }
    } catch (error) {
      console.error('Failed to parse URL for password recovery:', error)
    }
  }, [])
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null)
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [cancelAt, setCancelAt] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const isPmUser = userProfile?.role === 'pm'
  const propertyId = userProfile?.property_id ?? null

  const { data: pendingWorkOrdersCount = 0 } = useQuery({
    queryKey: queryKeys.pendingWorkOrders(propertyId),
    queryFn: () => fetchPendingWorkOrdersCount(propertyId),
    enabled: isPmUser && !!propertyId,
  })

  const { data: pendingTechniciansCount = 0 } = useQuery({
    queryKey: queryKeys.pendingTechnicians(propertyId),
    queryFn: () => fetchPendingTechniciansCount(propertyId),
    enabled: isPmUser && !!propertyId,
  })

  const { data: pendingTenantsCount = 0 } = useQuery({
    queryKey: queryKeys.pendingTenants(propertyId),
    queryFn: () => fetchPendingTenantsCount(propertyId),
    enabled: isPmUser && !!propertyId,
  })

  const refreshPendingCount = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingWorkOrders(propertyId) })
  }, [queryClient, propertyId])

  const refreshPendingTechniciansCount = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingTechnicians(propertyId) })
  }, [queryClient, propertyId])

  const refreshPendingTenantsCount = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingTenants(propertyId) })
  }, [queryClient, propertyId])

  const { hasUnseenPending: hasUnseenWorkOrders, acknowledge: acknowledgeWorkOrders } =
    usePendingAcknowledgment('work_orders', propertyId, pendingWorkOrdersCount)
  const { hasUnseenPending: hasUnseenTechnicians, acknowledge: acknowledgeTechnicians } =
    usePendingAcknowledgment('technicians', propertyId, pendingTechniciansCount)
  const { hasUnseenPending: hasUnseenTenants, acknowledge: acknowledgeTenants } =
    usePendingAcknowledgment('tenants', propertyId, pendingTenantsCount)


  const syncLocalStorageUser = useCallback((profile: UserProfile | null) => {
    if (!profile) return

    try {
      const userStr = localStorage.getItem('user')
      if (!userStr) return

      const userData = JSON.parse(userStr)
      const mergedUser = {
        ...userData,
        approved: normalizeApprovalStatus(profile.approved),
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
        const normalizedProfile: UserProfile = {
          ...profile,
          approved: normalizeApprovalStatus(profile.approved),
        }
        setUserProfile(normalizedProfile)
        setCancelAt(profile.cancel_at || null)
        syncLocalStorageUser(normalizedProfile)
        
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
          } else if (hasActiveSubscription || profile.subscription_status === 'active') {
            // Subscription is active again (e.g. after a successful renewal) - leave the renewal flow
            setShowRenewSubscription(false)
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

  // Verify email from ?token= whether the user is logged in or on the login screen.
  // (Resend from EmailVerificationBanner happens while logged in.)
  useEffect(() => {
    if (emailVerificationHandledRef.current) return

    let token: string | null = null
    try {
      const url = new URL(window.location.href)
      token = url.searchParams.get('token')
      // Password recovery uses different params; skip bare recovery flows
      if (url.searchParams.get('type') === 'recovery') return
    } catch {
      return
    }

    if (!token) return

    emailVerificationHandledRef.current = true
    setEmailVerificationNotice({
      type: 'pending',
      text: 'Verifying your email…',
    })

    const clearTokenFromUrl = () => {
      if (!window.history.replaceState) return
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      const next = `${url.pathname}${url.search}${url.hash}`
      window.history.replaceState({}, document.title, next || '/')
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(
          `${config.supabase.url}/functions/v1/verify-email?token=${encodeURIComponent(token!)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              apikey: config.supabase.anonKey,
            },
          }
        )
        const data = await response.json().catch(() => ({}))

        if (response.ok && data.success) {
          setEmailVerificationNotice({
            type: 'success',
            text: 'Email verified successfully.',
          })
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.user?.id) {
            await loadUserProfile(session.user.id)
          }
        } else {
          const errorMsg =
            data.error || 'Verification failed. The link may be expired or invalid.'
          const hintMsg = data.hint ? ` ${data.hint}` : ''
          setEmailVerificationNotice({
            type: 'error',
            text: `${errorMsg}${hintMsg}`,
          })
          console.error('Email verification failed:', data)
        }
      } catch (error) {
        console.error('Email verification error:', error)
        setEmailVerificationNotice({
          type: 'error',
          text: 'An error occurred during verification. Please try again.',
        })
      } finally {
        clearTokenFromUrl()
        window.setTimeout(() => setEmailVerificationNotice(null), 8000)
      }
    }

    void verifyEmail()
  }, [loadUserProfile])

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUserProfile(null)
    setCancelAt(null)
    queryClient.clear()
  }, [queryClient])

  /** Allow only PM / super_admin into the admin UI; sign others out. */
  const ensureAdminPanelAccess = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        const profile = await loadUserProfile(userId)
        if (isAdminPanelRole(profile?.role)) {
          return true
        }
        markAdminPanelAccessDenied()
        await supabase.auth.signOut()
        clearStoredSession()
        setIsLoggedIn(false)
        return false
      } catch (error) {
        console.error('Failed to verify admin panel role:', error)
        markAdminPanelAccessDenied()
        await supabase.auth.signOut()
        clearStoredSession()
        setIsLoggedIn(false)
        return false
      }
    },
    [loadUserProfile, clearStoredSession]
  )

  // Keep tokens in sync with Supabase session changes and refresh automatically
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // A recovery link establishes a temporary session; show the reset screen
      // instead of dropping the user into the dashboard.
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true)
        setIsCheckingAuth(false)
        if (session) {
          localStorage.setItem('access_token', session.access_token)
          if (session.refresh_token) {
            localStorage.setItem('refresh_token', session.refresh_token)
          }
        }
        return
      }

      if (session) {
        localStorage.setItem('access_token', session.access_token)
        if (session.refresh_token) {
          localStorage.setItem('refresh_token', session.refresh_token)
        }
        localStorage.setItem('user', JSON.stringify(session.user))
        void ensureAdminPanelAccess(session.user.id).then((allowed) => {
          if (allowed) setIsLoggedIn(true)
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
  }, [ensureAdminPanelAccess, clearStoredSession])

  // Handle payment success redirect (must be after loadUserProfile is defined)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sessionId = urlParams.get('session_id')
    const paymentStatus = urlParams.get('payment')
    const isRenewal = urlParams.get('renewal') === 'true'

    const clearPaymentParams = () => {
      if (window.history.replaceState) {
        const url = new URL(window.location.href)
        url.searchParams.delete('session_id')
        url.searchParams.delete('payment')
        url.searchParams.delete('renewal')
        window.history.replaceState({}, document.title, url.toString())
      }
    }

    if (paymentStatus === 'success' && sessionId && isRenewal) {
      console.log('App: Renewal payment successful, session ID:', sessionId)
      clearPaymentParams()

      // The subscription is finalized by the Stripe webhook, which can lag a
      // moment behind this redirect. Poll the profile until it reflects the
      // active subscription so the user lands on the dashboard instead of being
      // left on the renewal page.
      if (!paymentPollStartedRef.current) {
        paymentPollStartedRef.current = true

        const finalizeAfterPayment = async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          const uid = session?.user?.id
          if (!uid) return

          for (let attempt = 0; attempt < 8; attempt++) {
            try {
              const profile = await loadUserProfile(uid)
              if (profile?.subscription_status === 'active') {
                console.log('App: Subscription active after renewal, showing dashboard')
                return
              }
            } catch (error) {
              console.error('Error reloading profile after renewal payment:', error)
            }
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
          console.warn('App: Subscription still not active after polling; the Stripe webhook may not have processed the renewal yet.')
        }

        finalizeAfterPayment()
      }
    } else if (paymentStatus === 'success' && sessionId && !isRenewal) {
      // New PM signup: auto-login with credentials saved before Stripe redirect
      if (paymentPollStartedRef.current) return
      paymentPollStartedRef.current = true
      clearPaymentParams()

      const finalizeNewPmSignup = async () => {
        setIsFinalizingSignupPayment(true)
        const credentials = readPendingPmSignupCredentials()

        try {
          if (!credentials) {
            console.warn('App: No pending PM signup credentials after payment; falling back to login')
            setPmSignupLoginHint()
            return
          }

          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          })

          if (error || !data.session?.user) {
            console.error('App: Auto-login after PM signup failed:', error)
            setPmSignupLoginHint()
            return
          }

          localStorage.setItem('access_token', data.session.access_token)
          if (data.session.refresh_token) {
            localStorage.setItem('refresh_token', data.session.refresh_token)
          }
          localStorage.setItem('user', JSON.stringify(data.session.user))

          setIsLoggedIn(true)
          setShowSubscription(false)

          const uid = data.session.user.id
          for (let attempt = 0; attempt < 8; attempt++) {
            try {
              const profile = await loadUserProfile(uid)
              if (profile?.subscription_status === 'active') {
                console.log('App: New PM subscription active after signup payment')
                break
              }
            } catch (profileError) {
              console.error('Error loading profile after signup payment:', profileError)
            }
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        } finally {
          clearPendingPmSignupCredentials()
          signupPaymentReturnRef.current = false
          setIsFinalizingSignupPayment(false)
          setIsCheckingAuth(false)
        }
      }

      void finalizeNewPmSignup()
    } else if (paymentStatus === 'cancelled') {
      console.log('App: Payment was cancelled')
      clearPendingPmSignupCredentials()
      clearPaymentParams()
      signupPaymentReturnRef.current = false
      setIsFinalizingSignupPayment(false)
    }
  }, [loadUserProfile])

  // Initialize auth state on first load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          if (isPasswordRecoveryLanding()) {
            setShowResetPassword(true)
          } else {
            const allowed = await ensureAdminPanelAccess(session.user.id)
            if (allowed) setIsLoggedIn(true)
          }
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
              if (isPasswordRecoveryLanding()) {
                setShowResetPassword(true)
              } else {
                const allowed = await ensureAdminPanelAccess(data.session.user.id)
                if (allowed) setIsLoggedIn(true)
              }
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
        // Keep the loading screen up while we auto-login a new PM after Stripe
        if (!signupPaymentReturnRef.current) {
          setIsCheckingAuth(false)
        }
      }
    }

    initializeAuth()
  }, [ensureAdminPanelAccess, clearStoredSession])

  // Set up real-time subscriptions for PM data
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
          console.log('Work order changed, refreshing cache:', payload.eventType)
          invalidateWorkOrdersData(queryClient)
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
            console.log('Technician changed, refreshing cache:', payload.eventType)
            invalidateTechniciansData(queryClient)
          }

          if (isTenantChange) {
            console.log('Tenant changed, refreshing cache:', payload.eventType)
            invalidateTenantsData(queryClient)
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
  }, [userProfile, queryClient])

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
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session
      if (!session?.user?.id) return
      const allowed = await ensureAdminPanelAccess(session.user.id)
      if (allowed) setIsLoggedIn(true)
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

const pendingWorkOrdersContextValue = useMemo(
  () => ({
    pendingCount: pendingWorkOrdersCount,
    pendingTechniciansCount,
    pendingTenantsCount,
    hasUnseenWorkOrders,
    hasUnseenTechnicians,
    hasUnseenTenants,
    refreshPendingCount,
    refreshPendingTechniciansCount,
    refreshPendingTenantsCount,
    acknowledgeWorkOrders,
    acknowledgeTechnicians,
    acknowledgeTenants,
  }),
  [
    pendingWorkOrdersCount,
    pendingTechniciansCount,
    pendingTenantsCount,
    hasUnseenWorkOrders,
    hasUnseenTechnicians,
    hasUnseenTenants,
    refreshPendingCount,
    refreshPendingTechniciansCount,
    refreshPendingTenantsCount,
    acknowledgeWorkOrders,
    acknowledgeTechnicians,
    acknowledgeTenants,
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

  const handleNavigateToTechnicians = () => {
    setActiveItem('Technicians')
  }

  const handleNavigateToTenants = () => {
    setActiveItem('Tenants')
  }

  const alertsNavProps = {
    onNavigateToWorkOrder: handleNavigateToWorkOrder,
    onNavigateToTechnicians: handleNavigateToTechnicians,
    onNavigateToTenants: handleNavigateToTenants,
  }

  const renderContent = () => {
    if (showInvitePM) {
      return <InvitePM onBack={handleBackFromInvitePM} />
    }

    switch (activeItem) {
      case 'Dashboard':
        return (
          <Dashboard
            onNavigateToTenant={handleNavigateToTenant}
            {...alertsNavProps}
          />
        )
      case 'PM Accounts':
        return <PropertyManagers />
      case 'Waitlist':
        return <Waitlist />
      case 'Work Orders':
        return (
          <WorkOrders
            selectedWorkOrderId={selectedWorkOrderId}
            onClearSelectedWorkOrder={() => setSelectedWorkOrderId(null)}
            {...alertsNavProps}
          />
        )
      case 'Tenants':
        return (
          <Users
            selectedTenantFilter={selectedTenantFilter}
            onClearTenantFilter={() => setSelectedTenantFilter(null)}
            {...alertsNavProps}
          />
        )
      case 'Technicians':
        return <Technicians {...alertsNavProps} />
      case 'Approvals':
        return <Approvals />
      case 'Profile':
        return <Profile onLogout={handleLogout} />
      default:
        return (
          <Dashboard
            onNavigateToTenant={handleNavigateToTenant}
            {...alertsNavProps}
          />
        )
    }
  }

  // Show password-reset screen when arriving from a recovery email link
  if (showResetPassword) {
    return (
      <ResetPassword
        onComplete={() => {
          setShowResetPassword(false)
          if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.origin + '/')
          }
        }}
      />
    )
  }

  // Show loading state while checking authentication or finalizing signup payment
  if (isCheckingAuth || isFinalizingSignupPayment) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isFinalizingSignupPayment
              ? 'Activating your account...'
              : 'Checking authentication...'}
          </p>
        </div>
      </div>
    )
  }

  const emailVerificationBanner = emailVerificationNotice ? (
    <div
      className={`fixed top-0 inset-x-0 z-[60] px-4 py-3 text-center text-sm font-medium ${
        emailVerificationNotice.type === 'success'
          ? 'bg-green-600 text-white'
          : emailVerificationNotice.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-blue-600 text-white'
      }`}
      role="status"
    >
      {emailVerificationNotice.text}
    </div>
  ) : null

  // Show renew subscription page (for cancelled subscriptions)
  if (showRenewSubscription && userProfile?.role === 'pm') {
    return (
      <>
        {emailVerificationBanner}
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
      </>
    )
  }

  // Show subscription page (no authentication required)
  if (showSubscription) {
    return (
      <>
        {emailVerificationBanner}
        <Subscription
          onSuccess={handleSubscriptionSuccess}
          onBack={() => {
            setShowSubscription(false)
            setSubscriptionPrefill({
              name: '',
              email: '',
              propertyName: '',
            })
          }}
          initialName={subscriptionPrefill.name}
          initialEmail={subscriptionPrefill.email}
          initialPropertyName={subscriptionPrefill.propertyName}
        />
      </>
    )
  }

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return (
      <>
        {emailVerificationBanner}
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
      </>
    )
  }

  return (
    <PendingWorkOrdersProvider value={pendingWorkOrdersContextValue}>
      {emailVerificationBanner}
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
              {...alertsNavProps}
            />
          )}
          {userProfile?.role === 'pm' && (
            <>
              <SubscriptionCancellationBanner cancelAt={cancelAt} />
              {userProfile.email_verified !== true && (
                <EmailVerificationBanner 
                  email={userProfile.email} 
                  emailVerified={false}
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
