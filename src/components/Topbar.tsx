import { useState, useEffect } from 'react';
import { Search, Bell, UserPlus, Menu, X } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';

interface TopbarProps {
  onMenuToggle: () => void;
  onNewPMAccount: () => void;
  onLogout: () => void;
  onNavigateToWorkOrder: (workOrderId: string) => void;
}

interface WorkOrder {
  id: string;
  title: string | null;
  tenant_name?: string | null;
  status?: string | null;
  created_at?: string;
}

const Topbar = ({ onMenuToggle, onNewPMAccount, onLogout, onNavigateToWorkOrder }: TopbarProps) => {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [unseenWorkOrders, setUnseenWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  // Get user role from localStorage
  const getUserRole = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.user_metadata?.role) {
          return user.user_metadata.role;
        }
        if (user.raw_user_meta_data?.role) {
          return user.raw_user_meta_data.role;
        }
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
    return 'super_admin';
  };

  const userRole = getUserRole();
  const isPM = userRole === 'pm';

  // Fetch unseen work orders
  useEffect(() => {
    if (!isPM) return;

    const fetchUnseenWorkOrders = async () => {
      try {
        const supabaseClient = getAuthenticatedSupabase();
        
        // Get PM's property_id
        const { data: userData } = await supabaseClient.auth.getUser();
        if (!userData.user) return;

        const { data: pmData, error: pmError } = await supabaseClient
          .from('users')
          .select('property_id')
          .eq('id', userData.user.id)
          .eq('role', 'pm')
          .single();

        if (pmError || !pmData.property_id) return;

        // Fetch unseen work orders (false or NULL)
        const { data, error } = await supabaseClient
          .from('work_orders')
          .select('id, title, tenant_name, status')
          .eq('property_id', pmData.property_id)
          .or('seen_by_pm.is.null,seen_by_pm.eq.false')
          .order('id', { ascending: false });

        if (error) throw error;
        setUnseenWorkOrders(data || []);
      } catch (err) {
        console.error('Error fetching unseen work orders:', err);
      }
    };

    fetchUnseenWorkOrders();
    // Refresh every 30 seconds to check for new work orders
    const interval = setInterval(fetchUnseenWorkOrders, 30000);
    return () => clearInterval(interval);
  }, [isPM]);

  const handleAlertsClick = () => {
    setAlertsOpen(!alertsOpen);
  };

  const handleWorkOrderClick = async (workOrderId: string) => {
    // Mark as seen first
    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      const { error } = await supabaseClient
        .from('work_orders')
        .update({ seen_by_pm: true })
        .eq('id', workOrderId);

      if (error) throw error;

      // Remove from unseen list
      setUnseenWorkOrders(prev => prev.filter(wo => wo.id !== workOrderId));
      
      // Close modal and navigate to work order
      setAlertsOpen(false);
      onNavigateToWorkOrder(workOrderId);
    } catch (err) {
      console.error('Error marking work order as seen:', err);
    }
  };

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
            placeholder={isPM ? "Search tenants, technicians…" : "Search PMs, properties…"}
            className="block w-full pl-10 pr-3 py-2 bg-gray-50 border-0 rounded-full text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Right side - Notifications and New PM Account button */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        {isPM && (
          <div className="flex items-center space-x-2 relative">
            <div 
              onClick={handleAlertsClick}
              className="relative p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
            >
              <Bell className="w-4 h-4 text-gray-600" />
              {unseenWorkOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              )}
            </div>
            <span className="hidden sm:block text-sm font-medium text-gray-600">Alerts</span>
          </div>
        )}

        {/* New PM Account Button - Only show for super admin */}
        {!isPM && (
          <button 
            onClick={onNewPMAccount}
            className="bg-teal-600 text-white px-4 py-2 rounded-full flex items-center gap-2 cursor-pointer hover:bg-teal-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span className="font-medium">New PM Account</span>
          </button>
        )}
      </div>

      {/* Alerts Modal */}
      {alertsOpen && isPM && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={handleAlertsClick}
          />
          {/* Modal */}
          <div className="fixed top-16 right-6 w-96 bg-white rounded-xl shadow-lg z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">New Work Orders</h2>
              <button
                onClick={handleAlertsClick}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loadingAlerts ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-500 text-sm">Loading alerts...</p>
                </div>
              ) : unseenWorkOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No new work orders</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {unseenWorkOrders.map((workOrder) => (
                    <div 
                      key={workOrder.id} 
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleWorkOrderClick(workOrder.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {workOrder.title || 'Untitled Work Order'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {workOrder.tenant_name && (
                              <span>{workOrder.tenant_name}</span>
                            )}
                            {workOrder.tenant_name && workOrder.status && (
                              <span>•</span>
                            )}
                            {workOrder.status && (
                              <span className="capitalize">{workOrder.status}</span>
                            )}
                          </div>
                        </div>
                        <span className="ml-2 w-2 h-2 bg-red-500 rounded-full"></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Topbar;
