import type { FC } from 'react';
import { Grid3X3, Shield, Building, FileText, X, ClipboardList, Users, Wrench, User, Mail } from 'lucide-react';
import { usePendingWorkOrders } from '../context/PendingWorkOrdersContext';
import AsineLogo from './AsineLogo';

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
  const {
    hasUnseenWorkOrders,
    hasUnseenTechnicians,
    hasUnseenTenants,
    acknowledgeWorkOrders,
    acknowledgeTechnicians,
    acknowledgeTenants,
  } = usePendingWorkOrders();

  // Navigation items for Super Admin
  const adminNavigationItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: Grid3X3 },
    { id: 'PM Accounts', label: 'PM Accounts', icon: Shield },
    { id: 'Waitlist', label: 'PM Waitlist', icon: Mail },
    { id: 'Properties', label: 'Properties', icon: Building },
    { id: 'Audit Logs', label: 'Audit Logs', icon: FileText },
  ];

  // Navigation items for PM
  const pmNavigationItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: Grid3X3 },
    { id: 'Work Orders', label: 'Work Orders', icon: ClipboardList },
    { id: 'Tenants', label: 'Tenants', icon: Users },
    { id: 'Technicians', label: 'Technicians', icon: Wrench },
    { id: 'Profile', label: 'Profile', icon: User },
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
        fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:fixed lg:z-auto
        w-64
      `}>
        <div className="flex flex-col h-full" style={{ marginTop: '-50px', position: 'relative' }}>
          {/* Header */}
          <div className="flex items-start justify-between px-4 pt-0 pb-0" style={{ marginBottom: '-40px' }}>
            <div style={{ paddingBottom: '20px' }}>
              <AsineLogo size="lg" />
            </div>
            <div
              onClick={onToggle}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-4 h-4 text-gray-600" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 pt-0 pb-6 overflow-y-auto" style={{ marginTop: '-40px' }}>
            <ul className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeItem === item.id;
                return (
                  <li key={item.id}>
                    <div
                      onClick={() => {
                        onActiveItemChange(item.id);
                        if (item.id === 'Work Orders') acknowledgeWorkOrders();
                        if (item.id === 'Technicians') acknowledgeTechnicians();
                        if (item.id === 'Tenants') acknowledgeTenants();
                      }}
                      className={`
                        w-full flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors
                        ${isActive
                          ? 'bg-teal-50 text-teal-700 font-medium'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50 font-normal'
                        }
                      `}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-teal-600' : 'text-gray-500'}`} />
                        <span>{item.label}</span>
                      </span>
                      {item.id === 'Work Orders' && isPM && hasUnseenWorkOrders && (
                        <span className="ml-3 inline-flex items-center justify-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                          <span className="sr-only">New pending work orders</span>
                        </span>
                      )}
                      {item.id === 'Technicians' && isPM && hasUnseenTechnicians && (
                        <span className="ml-3 inline-flex items-center justify-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                          <span className="sr-only">New pending technicians</span>
                        </span>
                      )}
                      {item.id === 'Tenants' && isPM && hasUnseenTenants && (
                        <span className="ml-3 inline-flex items-center justify-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                          <span className="sr-only">New pending tenants</span>
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
