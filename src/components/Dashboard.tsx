import { useState, useEffect } from 'react';
import { ChevronDown, Search, Clock, Sun, CheckCircle, AlertTriangle, Flame, Shield, User, Wrench, UserPlus } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';

interface WorkOrder {
  id: string;
  title: string | null;
  description: string | null;
  priority: 'Low' | 'Medium' | 'High' | null;
  status: string | null;
  property_name?: string;
  tenant_name?: string;
}

const Dashboard = () => {
  // Get user information for personalized welcome message
  const getUserName = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        // Check user_metadata first (Supabase auth stores name here)
        if (user.user_metadata?.name) {
          return user.user_metadata.name;
        }
        // Fallback to raw_user_meta_data
        if (user.raw_user_meta_data?.name) {
          return user.raw_user_meta_data.name;
        }
        // Last fallback to email if name not available
        return user.email?.split('@')[0] || 'Admin';
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
    return 'Admin';
  };

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

  const userName = getUserName();
  const userRole = getUserRole();
  const isPM = userRole === 'pm';

  // Overview cards for Super Admin
  const adminOverviewCards = [
    {
      title: 'Active PMs',
      value: '24',
      subtitle: 'Across all regions',
    },
    {
      title: 'Assigned Properties',
      value: '156',
      subtitle: 'Managed portfolio',
    },
    {
      title: 'Pending Invites',
      value: '5',
      subtitle: 'Awaiting acceptance',
    },
  ];

  // Overview cards for PM (work orders stats)
  const pmOverviewCards = [
    {
      title: 'Pending',
      value: '18',
      subtitle: 'Awaiting assignment',
    },
    {
      title: 'In Progress',
      value: '27',
      subtitle: 'Technician working',
    },
    {
      title: 'Resolved',
      value: '142',
      subtitle: 'Last 30 days',
    },
  ];

  const overviewCards = isPM ? pmOverviewCards : adminOverviewCards;

  // State for work orders
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);
  const [errorWorkOrders, setErrorWorkOrders] = useState<string | null>(null);

  // Fetch work orders from database
  useEffect(() => {
    if (!isPM) return; // Only fetch for PM users

    const fetchWorkOrders = async () => {
      setLoadingWorkOrders(true);
      setErrorWorkOrders(null);

      try {
        const supabaseClient = getAuthenticatedSupabase();
        
        console.log('Fetching work orders...');
        
        // Fetch work orders first
        const { data: ordersData, error: ordersError } = await supabaseClient
          .from('work_orders')
          .select('id, title, description, priority, status, tenant_id, property_id')
          .order('id', { ascending: false })
          .limit(3);

        if (ordersError) {
          console.error('Work orders query error:', ordersError);
          throw ordersError;
        }

        console.log('Work orders fetched:', ordersData);

        if (!ordersData || ordersData.length === 0) {
          console.log('No work orders found in database');
          setWorkOrders([]);
          return;
        }

        // Collect unique tenant and property IDs
        const tenantIds = [...new Set(ordersData.map((o: any) => o.tenant_id).filter(Boolean))];
        const propertyIds = [...new Set(ordersData.map((o: any) => o.property_id).filter(Boolean))];

        // Fetch tenant and property names in batch
        const [tenantsResult, propertiesResult] = await Promise.all([
          tenantIds.length > 0
            ? supabaseClient.from('tenants').select('id, name').in('id', tenantIds)
            : Promise.resolve({ data: [], error: null }),
          propertyIds.length > 0
            ? supabaseClient.from('properties').select('id, name').in('id', propertyIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        // Create maps for quick lookup
        const tenantMap = new Map((tenantsResult.data || []).map((t: any) => [t.id, t.name]));
        const propertyMap = new Map((propertiesResult.data || []).map((p: any) => [p.id, p.name]));

        // Transform the data
        const transformedData: WorkOrder[] = ordersData.map((order: any) => ({
          id: order.id,
          title: order.title || order.description || 'Untitled',
          description: order.description,
          priority: order.priority as 'Low' | 'Medium' | 'High' | null,
          status: order.status,
          property_name: order.property_id ? (propertyMap.get(order.property_id) || 'N/A') : 'N/A',
          tenant_name: order.tenant_id ? (tenantMap.get(order.tenant_id) || 'N/A') : 'N/A',
        }));

        setWorkOrders(transformedData);
      } catch (err: any) {
        console.error('Error fetching work orders:', err);
        
        // Handle RLS policy recursion error specifically
        if (err.message?.includes('infinite recursion') || err.message?.includes('policy')) {
          setErrorWorkOrders('Permission error: Please check database policies. Contact administrator.');
        } else {
          setErrorWorkOrders(err.message || 'Failed to load work orders');
        }
      } finally {
        setLoadingWorkOrders(false);
      }
    };

    fetchWorkOrders();
  }, [isPM]);

  // Helper function to get priority icon
  const getPriorityIcon = (priority: string | null) => {
    switch (priority) {
      case 'High':
        return Flame;
      case 'Medium':
        return AlertTriangle;
      case 'Low':
        return Shield;
      default:
        return AlertTriangle;
    }
  };

  // Helper function to get status icon and color
  const getStatusInfo = (status: string | null) => {
    switch (status) {
      case 'Pending':
        return { icon: Clock, color: 'bg-orange-100 text-orange-700' };
      case 'In Progress':
        return { icon: Sun, color: 'bg-blue-100 text-blue-700' };
      case 'Resolved':
        return { icon: CheckCircle, color: 'bg-green-100 text-green-700' };
      default:
        return { icon: Clock, color: 'bg-gray-100 text-gray-700' };
    }
  };

  // Sample users data (for PM dashboard)
  const users = [
    {
      id: 1,
      name: 'Sam Carter',
      role: 'Technician',
      roleIcon: Wrench,
      tenant: 'Sarah Johnson',
      avatar: 'SC',
    },
    {
      id: 2,
      name: 'Rina Patel',
      role: 'Tenant',
      roleIcon: User,
      tenant: 'Michael Chen',
      avatar: 'RP',
    },
    {
      id: 3,
      name: 'John Martinez',
      role: 'Technician',
      roleIcon: Wrench,
      tenant: 'Emily Rodriguez',
      avatar: 'JM',
    },
  ];

  return (
    <div className="p-6">
      {/* Welcome Message */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {userName}!
        </h1>
        <p className="text-gray-600">
          Here's an overview of your management dashboard
        </p>
      </div>

      {/* Overview Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">Overview</h2>
        
        {/* Time Period Dropdown */}
        <div className="relative">
          <select className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>Last 90 days</option>
            <option>Last year</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {overviewCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-sm font-medium text-gray-500 mb-2">{card.title}</h3>
            
            <div className="mb-2">
              <span className="text-3xl font-semibold text-gray-900">
                {card.value}
              </span>
            </div>
            
            <p className="text-sm text-gray-400">{card.subtitle}</p>
          </div>
        ))}
      </div>

      {/* PM Dashboard: Work Orders and Users */}
      {isPM ? (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Work Orders Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Work Orders</h3>
            </div>
            
            {/* Search and Filters */}
            <div className="mb-4 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <select className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                  <option>Status: All</option>
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Resolved</option>
                </select>
                <select className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                  <option>Property: Any</option>
                </select>
              </div>
            </div>

            {/* Work Orders Table */}
            <div className="overflow-x-auto">
              {loadingWorkOrders ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading work orders...</p>
                </div>
              ) : errorWorkOrders ? (
                <div className="text-center py-8">
                  <p className="text-red-500">{errorWorkOrders}</p>
                </div>
              ) : workOrders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No work orders found</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Title</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Property</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Tenant</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Priority</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrders.map((order) => {
                      const PriorityIcon = getPriorityIcon(order.priority);
                      const { icon: StatusIcon, color: statusColor } = getStatusInfo(order.status);
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-2 text-sm font-medium text-gray-900">{order.title}</td>
                          <td className="py-3 px-2 text-sm text-gray-600">{order.property_name}</td>
                          <td className="py-3 px-2 text-sm text-gray-600">{order.tenant_name}</td>
                          <td className="py-3 px-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                              <PriorityIcon className="w-3 h-3" />
                              {order.priority || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${statusColor}`}>
                              <StatusIcon className="w-3 h-3" />
                              {order.status || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-2">
                              {order.status === 'Pending' && (
                                <>
                                  <button className="text-xs px-2 py-1 text-teal-600 hover:bg-teal-50 rounded">
                                    <UserPlus className="w-3 h-3 inline mr-1" />
                                    Assign
                                  </button>
                                  <button className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-50 rounded">Details</button>
                                </>
                              )}
                              {order.status === 'In Progress' && (
                                <>
                                  <button className="text-xs px-2 py-1 text-teal-600 hover:bg-teal-50 rounded">
                                    <UserPlus className="w-3 h-3 inline mr-1" />
                                    Reassign
                                  </button>
                                  <button className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-50 rounded">Details</button>
                                </>
                              )}
                              {order.status === 'Resolved' && (
                                <>
                                  <button className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-50 rounded">View</button>
                                  <button className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-50 rounded">Reopen</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Users Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Users</h3>
              <select className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                <option>Role: All</option>
                <option>Tenant</option>
                <option>Technician</option>
              </select>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Role</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Tenant</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const RoleIcon = user.roleIcon;
                    return (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-teal-700">{user.avatar}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{user.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                            <RoleIcon className="w-3 h-3" />
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600">{user.tenant}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Super Admin: Recent Activity */
      <div className="mt-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="text-center py-12">
            <p className="text-gray-500">No recent activity to display</p>
            <p className="text-sm text-gray-400 mt-2">Activity will appear here as it happens</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default Dashboard;
