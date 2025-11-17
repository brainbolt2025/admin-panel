import { useState, useEffect } from 'react';
import { ChevronDown, Clock, Sun, CheckCircle, AlertTriangle, Flame, Shield, User, Wrench, UserPlus } from 'lucide-react';
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

interface User {
  id: string;
  name: string | null;
  role: string | null;
  approved?: boolean;
}

interface DashboardProps {
  onNavigateToTenant?: (tenantName: string) => void;
  onNavigateToWorkOrder?: (workOrderId: string) => void;
}

const Dashboard = ({ onNavigateToTenant, onNavigateToWorkOrder }: DashboardProps) => {
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

  const getUserPropertyId = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return (
          user.profile?.property_id ||
          user.user_metadata?.property_id ||
          user.raw_user_meta_data?.property_id ||
          null
        );
      }
    } catch (error) {
      console.error('Error parsing user data for property_id:', error);
    }
    return null;
  };

  const userName = getUserName();
  const userRole = getUserRole();
  const isPM = userRole === 'pm';
  const [pmPropertyId, setPmPropertyId] = useState<string | null>(() => getUserPropertyId());

  const [adminStats, setAdminStats] = useState({
    activePMs: 0,
    assignedProperties: 0,
    loading: true,
    error: null as string | null,
  });

  // Overview cards for Super Admin
  const adminOverviewCards = [
    {
      title: 'Active PMs',
      value: adminStats.loading ? '—' : adminStats.activePMs.toString(),
      subtitle: 'Across all regions',
    },
    {
      title: 'Assigned Properties',
      value: adminStats.loading ? '—' : adminStats.assignedProperties.toString(),
      subtitle: 'Managed portfolio',
    },
    {
      title: 'Pending Invites',
      value: '5',
      subtitle: 'Awaiting acceptance',
    },
  ];
  useEffect(() => {
    if (isPM) return;

    const fetchAdminStats = async () => {
      setAdminStats((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const supabaseClient = getAuthenticatedSupabase();

        const [{ count: pmCount, error: pmError }, { count: propertyCount, error: propertyError }] =
          await Promise.all([
            supabaseClient
              .from('users')
              .select('id', { count: 'exact', head: true })
              .eq('role', 'pm'),
            supabaseClient
              .from('properties')
              .select('id', { count: 'exact', head: true }),
          ]);

        if (pmError) throw pmError;
        if (propertyError) throw propertyError;

        setAdminStats({
          activePMs: pmCount ?? 0,
          assignedProperties: propertyCount ?? 0,
          loading: false,
          error: null,
        });
      } catch (error: any) {
        console.error('Error fetching admin overview stats:', error);
        setAdminStats((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || 'Failed to fetch overview stats',
        }));
      }
    };

    fetchAdminStats();
  }, [isPM, pmPropertyId]);


  // Overview cards for PM (work orders stats)
  const [pmStats, setPmStats] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    loading: true,
    error: null as string | null,
  });

  const pmOverviewCards = [
    {
      title: 'Pending',
      value: pmStats.loading ? '—' : pmStats.pending.toString(),
      subtitle: 'Awaiting assignment',
    },
    {
      title: 'In Progress',
      value: pmStats.loading ? '—' : pmStats.inProgress.toString(),
      subtitle: 'Technician working',
    },
    {
      title: 'Completed',
      value: pmStats.loading ? '—' : pmStats.completed.toString(),
      subtitle: 'Last 30 days',
    },
  ];

  const overviewCards = isPM ? pmOverviewCards : adminOverviewCards;

  // State for work orders
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);
  const [errorWorkOrders, setErrorWorkOrders] = useState<string | null>(null);

  // State for users (tenants and technicians)
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);

  // Fetch work orders from database
  useEffect(() => {
    if (!isPM) return; // Only fetch for PM users

    const fetchWorkOrders = async () => {
      setLoadingWorkOrders(true);
      setErrorWorkOrders(null);
      setPmStats((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const supabaseClient = getAuthenticatedSupabase();
        
        console.log('Fetching work orders...');
        
        // Fetch work orders first
        let ordersQuery = supabaseClient
          .from('work_orders')
          .select('id, title, description, priority, status, tenant_name')
          .order('id', { ascending: false })
          .limit(3);

        if (pmPropertyId) {
          ordersQuery = ordersQuery.eq('property_id', pmPropertyId);
        }

        const { data: ordersData, error: ordersError } = await ordersQuery;

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

        // Transform the data (tenant_name is already in the work_orders table)
        const transformedData: WorkOrder[] = ordersData.map((order: any) => ({
          id: order.id,
          title: order.title || order.description || 'Untitled',
          description: order.description,
          priority: order.priority as 'Low' | 'Medium' | 'High' | null,
          status: order.status,
          tenant_name: order.tenant_name || 'N/A',
        }));

        setWorkOrders(transformedData);

        const buildCountQuery = (status: string) => {
          let query = supabaseClient
            .from('work_orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', status);

          if (pmPropertyId) {
            query = query.eq('property_id', pmPropertyId);
          }

          return query;
        };

        const [{ count: pendingCount, error: pendingError }, { count: inProgressCount, error: inProgressError }, { count: completedCount, error: completedError }] =
          await Promise.all([
            buildCountQuery('Pending'),
            buildCountQuery('In Progress'),
            buildCountQuery('Completed'),
          ]);

        if (pendingError || inProgressError || completedError) {
          throw pendingError || inProgressError || completedError;
        }

        setPmStats({
          pending: pendingCount ?? 0,
          inProgress: inProgressCount ?? 0,
          completed: completedCount ?? 0,
          loading: false,
          error: null,
        });
      } catch (err: any) {
        console.error('Error fetching work orders:', err);
        
        // Handle RLS policy recursion error specifically
        if (err.message?.includes('infinite recursion') || err.message?.includes('policy')) {
          setErrorWorkOrders('Permission error: Please check database policies. Contact administrator.');
        } else {
          setErrorWorkOrders(err.message || 'Failed to load work orders');
        }
        setPmStats((prev) => ({
          ...prev,
          loading: false,
          error: err.message || 'Failed to load overview stats',
        }));
      } finally {
        setLoadingWorkOrders(false);
      }
    };

    fetchWorkOrders();
  }, [isPM]);

  // Fetch users (tenants and technicians) from the same property as the PM
  useEffect(() => {
    if (!isPM) return; // Only fetch for PM users

    const fetchUsers = async () => {
      setLoadingUsers(true);
      setErrorUsers(null);

      try {
        const supabaseClient = getAuthenticatedSupabase();
        
        console.log('Fetching PM property and users...');
        
        // First, get the PM user's property_id from the users table
        const accessToken = localStorage.getItem('access_token');
        let currentUserId: string | null = null;
        
        if (accessToken) {
          // Decode JWT to get user ID
          try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            currentUserId = payload.sub;
          } catch (e) {
            console.error('Error decoding token:', e);
          }
        }

        if (!currentUserId) {
          throw new Error('Could not determine current user ID');
        }

        // Get PM user's property_id
        const { data: pmUser, error: pmError } = await supabaseClient
          .from('users')
          .select('property_id')
          .eq('id', currentUserId)
          .single();

        if (pmError) throw pmError;
        if (!pmUser?.property_id) {
          console.log('PM user has no property assigned');
          setPmPropertyId(null);
          setUsers([]);
          return;
        }

        setPmPropertyId(pmUser.property_id);

        // Fetch the latest 5 users (tenants and technicians) from the same property
        const { data: usersData, error: usersError } = await supabaseClient
          .from('users')
          .select('id, name, role, approved, property_id')
          .eq('property_id', pmUser.property_id)
          .in('role', ['tenant', 'technician'])
          .order('id', { ascending: false })
          .limit(5);

        if (usersError) {
          console.error('Users query error:', usersError);
          throw usersError;
        }

        if (!usersData || usersData.length === 0) {
          console.log('No users found for this property');
          setUsers([]);
          return;
        }

        // Transform the data
        const transformedData: User[] = usersData.map((user: any) => ({
          id: user.id,
          name: user.name || 'Unknown',
          role: user.role,
          approved: user.approved || false,
        }));

        setUsers(transformedData);
      } catch (err: any) {
        console.error('Error fetching users:', err);
        setErrorUsers(err.message || 'Failed to load users');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
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
      case 'Completed':
        return { icon: CheckCircle, color: 'bg-green-100 text-green-700' };
      default:
        return { icon: Clock, color: 'bg-gray-100 text-gray-700' };
    }
  };

  // Helper function to get role icon
  const getRoleIcon = (role: string | null) => {
    switch (role) {
      case 'technician':
        return Wrench;
      case 'tenant':
        return User;
      default:
        return User;
    }
  };

  return (
    <div className="p-6">
      {/* Welcome Message */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome, {userName}!
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
              <h3 className="text-lg font-semibold text-gray-900">Recent Work Orders</h3>
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
                        <tr 
                          key={order.id} 
                          className={`border-b border-gray-100 ${onNavigateToWorkOrder ? 'hover:bg-gray-50 cursor-pointer' : 'hover:bg-gray-50'}`}
                          onClick={() => {
                            if (onNavigateToWorkOrder) {
                              onNavigateToWorkOrder(order.id);
                            }
                          }}
                        >
                          <td className={`py-3 px-2 text-sm font-medium ${onNavigateToWorkOrder ? 'text-teal-600 hover:text-teal-700 hover:underline' : 'text-gray-900'}`}>{order.title}</td>
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

          {/* Tenants Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Tenants</h3>
            </div>

            {/* Tenants Table */}
            <div className="overflow-x-auto">
              {loadingUsers ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading tenants...</p>
                </div>
              ) : errorUsers ? (
                <div className="text-center py-8">
                  <p className="text-red-500">{errorUsers}</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No users found</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Role</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const RoleIcon = getRoleIcon(user.role);
                      const initials = user.name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase() || 'N/A';
                      const isTenant = user.role === 'tenant';
                      return (
                        <tr 
                          key={user.id} 
                          className={`border-b border-gray-100 ${isTenant && onNavigateToTenant ? 'hover:bg-gray-50 cursor-pointer' : 'hover:bg-gray-50'}`}
                          onClick={() => {
                            if (isTenant && onNavigateToTenant && user.name) {
                              onNavigateToTenant(user.name);
                            }
                          }}
                        >
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-semibold text-teal-700">{initials}</span>
                              </div>
                              <span className={`text-sm font-medium ${isTenant && onNavigateToTenant ? 'text-teal-600 hover:text-teal-700 hover:underline' : 'text-gray-900'}`}>{user.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                              <RoleIcon className="w-3 h-3" />
                              {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown'}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                              user.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {user.approved ? '✓ Approved' : '✗ Not Approved'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
