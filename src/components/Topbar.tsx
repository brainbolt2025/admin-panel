import { Search, Bell, UserPlus, Menu, LogOut } from 'lucide-react';

interface TopbarProps {
  onMenuToggle: () => void;
  onNewPMAccount: () => void;
  onLogout: () => void;
}

const Topbar = ({ onMenuToggle, onNewPMAccount, onLogout }: TopbarProps) => {
  return (
    <header className="flex items-center justify-between bg-white px-6 py-4 border-b border-gray-200">
      {/* Left side - Mobile menu button and search */}
      <div className="flex items-center space-x-4 flex-1">
        <div
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-md hover:bg-gray-100 cursor-pointer"
        >
          <Menu className="w-4 h-4 text-gray-600" />
        </div>
        
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search PMs, properties…"
            className="block w-full pl-10 pr-3 py-2 bg-gray-50 border-0 rounded-full text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Right side - Notifications and New PM Account button */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <div className="flex items-center space-x-2">
          <div className="relative p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
            <Bell className="w-4 h-4 text-gray-600" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          </div>
          <span className="hidden sm:block text-sm font-medium text-gray-600">Alerts</span>
        </div>

        {/* New PM Account Button */}
        <button 
          onClick={onNewPMAccount}
          className="bg-teal-600 text-white px-4 py-2 rounded-full flex items-center gap-2 cursor-pointer hover:bg-teal-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span className="font-medium">New PM Account</span>
        </button>

        {/* Logout Button */}
        <button 
          onClick={onLogout}
          className="bg-gray-600 text-white px-4 py-2 rounded-full flex items-center gap-2 cursor-pointer hover:bg-gray-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
