import type { FC } from 'react';
import { Grid3X3, Shield, Building, FileText, X, ClipboardList, Users, Wrench } from 'lucide-react';
import { usePendingWorkOrders } from '../context/PendingWorkOrdersContext';

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeItem: string;
  onActiveItemChange: (item: string) => void;
}

const Sidebar: FC<SidebarProps> = ({ isOpen, onToggle, activeItem, onActiveItemChange }) => {
  // Get user role from localStorage
  const getUserRole = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.profile?.role) {
          return user.profile.role;
        }
        // Check user_metadata first (Supabase auth stores role here)
        if (user.user_metadata?.role) {
          return user.user_metadata.role;
        }
        // Fallback to raw_user_meta_data
        if (user.raw_user_meta_data?.role) {
          return user.raw_user_meta_data.role;
        }
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
    return 'super_admin'; // Default to super admin if role not found
  };

  const userRole = getUserRole();
  const isPM = userRole === 'pm';
  const { pendingCount } = usePendingWorkOrders();

  // Navigation items for Super Admin
  const adminNavigationItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: Grid3X3 },
    { id: 'PM Accounts', label: 'PM Accounts', icon: Shield },
    { id: 'Properties', label: 'Properties', icon: Building },
    { id: 'Audit Logs', label: 'Audit Logs', icon: FileText },
  ];

  // Navigation items for PM
  const pmNavigationItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: Grid3X3 },
    { id: 'Work Orders', label: 'Work Orders', icon: ClipboardList },
    { id: 'Users', label: 'Users', icon: Users },
    { id: 'Technicians', label: 'Technicians', icon: Wrench },
  ];

  const navigationItems = isPM ? pmNavigationItems : adminNavigationItems;

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
                <span className="text-white font-bold text-sm">
                  {isPM ? 'PM' : 'SA'}
                </span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">
                  {isPM ? 'Property Manager' : 'Super Admin'}
                </h1>
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
                      onClick={() => onActiveItemChange(item.id)}
                      className={`
                        w-full flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors font-medium
                        ${activeItem === item.id
                          ? 'bg-teal-50 text-teal-700'
                          : 'text-gray-600 hover:text-teal-600 hover:bg-gray-50'
                        }
                      `}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </span>
                      {item.id === 'Work Orders' && isPM && pendingCount > 0 && (
                        <span className="ml-3 inline-flex items-center justify-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                          <span className="sr-only">
                            {pendingCount} pending work order{pendingCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      )}
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
