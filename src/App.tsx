import { useState } from 'react'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './components/Dashboard'
import PropertyManagers from './components/PropertyManagers'
import InvitePM from './components/InvitePM'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState('Dashboard')
  const [showInvitePM, setShowInvitePM] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const handleNewPMAccount = () => {
    setShowInvitePM(true)
  }

  const handleBackFromInvitePM = () => {
    setShowInvitePM(false)
  }

  const handleLogin = () => {
    setIsLoggedIn(true)
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

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />
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
        <Topbar onMenuToggle={toggleSidebar} onNewPMAccount={handleNewPMAccount} />
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default App
