import { useState, useEffect } from 'react'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './components/Dashboard'
import PropertyManagers from './components/PropertyManagers'
import InvitePM from './components/InvitePM'
import Subscription from './components/Subscription'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState('Dashboard')
  const [showInvitePM, setShowInvitePM] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)

  // Check for existing tokens and refresh if needed
  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('access_token')
      
      if (accessToken) {
        // Check if token is still valid
        const isValid = await checkTokenValidity(accessToken)
        
        if (isValid) {
          setIsLoggedIn(true)
        } else {
          // Try to refresh the token
          const refreshed = await refreshToken()
          if (refreshed) {
            setIsLoggedIn(true)
          } else {
            // Clear invalid tokens
            clearTokens()
          }
        }
      }
      
      setIsCheckingAuth(false)
    }

    checkAuth()
  }, [])

  const checkTokenValidity = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(
        'https://qmhmgjzkpfzxfjdurigu.supabase.co/auth/v1/user',
        {
          method: 'GET',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaG1nanprcGZ6eGZqZHVyaWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNDcwODcsImV4cCI6MjA3NjgyMzA4N30.ALgIUUSgxuDaaEIuh-izKHAcRiWURLjje4jxUDalC1Y',
            'Authorization': `Bearer ${token}`
          }
        }
      )
      return response.ok
    } catch (error) {
      return false
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) return false

      const response = await fetch(
        'https://qmhmgjzkpfzxfjdurigu.supabase.co/auth/v1/token?grant_type=refresh_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaG1nanprcGZ6eGZqZHVyaWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNDcwODcsImV4cCI6MjA3NjgyMzA4N30.ALgIUUSgxuDaaEIuh-izKHAcRiWURLjje4jxUDalC1Y',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaG1nanprcGZ6eGZqZHVyaWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNDcwODcsImV4cCI6MjA3NjgyMzA4N30.ALgIUUSgxuDaaEIuh-izKHAcRiWURLjje4jxUDalC1Y'
          },
          body: JSON.stringify({
            refresh_token: refreshToken
          })
        }
      )

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        localStorage.setItem('user', JSON.stringify(data.user))
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  const clearTokens = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
  }

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
    setIsLoggedIn(true)
  }

  const handleLogout = async () => {
    try {
      const accessToken = localStorage.getItem('access_token')
      
      if (accessToken) {
        const response = await fetch(
          'https://qmhmgjzkpfzxfjdurigu.supabase.co/auth/v1/logout',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaG1nanprcGZ6eGZqZHVyaWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNDcwODcsImV4cCI6MjA3NjgyMzA4N30.ALgIUUSgxuDaaEIuh-izKHAcRiWURLjje4jxUDalC1Y',
              'Authorization': `Bearer ${accessToken}`
            }
          }
        )

        if (response.ok) {
          // Clear tokens and redirect to login
          clearTokens()
          setIsLoggedIn(false)
        } else {
          // Even if logout fails, clear tokens and redirect
          clearTokens()
          setIsLoggedIn(false)
        }
      } else {
        // No token, just redirect to login
        setIsLoggedIn(false)
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Clear tokens and redirect even on error
      clearTokens()
      setIsLoggedIn(false)
    }
  }

  const renderContent = () => {
    if (showInvitePM) {
      return <InvitePM onBack={handleBackFromInvitePM} />
    }

    switch (activeItem) {
      case 'Dashboard':
        return <Dashboard />
      case 'PM Accounts':
        return <PropertyManagers />
      default:
        return <Dashboard />
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
        />
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default App
