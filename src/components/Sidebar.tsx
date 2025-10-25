import { useState } from 'react';
import { Grid3X3, Shield, Building, FileText, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const [activeItem, setActiveItem] = useState('Dashboard');

  const navigationItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: Grid3X3 },
    { id: 'PM Accounts', label: 'PM Accounts', icon: Shield },
    { id: 'Properties', label: 'Properties', icon: Building },
    { id: 'Audit Logs', label: 'Audit Logs', icon: FileText },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-white rounded-r-2xl shadow-lg z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
        w-64
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SA</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">Super Admin</h1>
              </div>
            </div>
            <div
              onClick={onToggle}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-4 h-4 text-gray-600" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 pb-6">
            <ul className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <div
                      onClick={() => setActiveItem(item.id)}
                      className={`
                        w-full flex items-center space-x-3 px-4 py-3 rounded-lg cursor-pointer transition-colors font-medium
                        ${activeItem === item.id
                          ? 'bg-teal-50 text-teal-700'
                          : 'text-gray-600 hover:text-teal-600 hover:bg-gray-50'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
