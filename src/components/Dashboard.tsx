import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Clock, Sun, CheckCircle, AlertTriangle, Flame, Shield, User, Wrench, UserPlus, Search, ClipboardList, Users, Building2, Mail } from 'lucide-react';
import { queryKeys } from '../lib/queryKeys';
import {
  derivePmWorkOrderStats,
  fetchAdminStatsQuery,
  fetchCurrentUserName,
  fetchTenantsQuery,
  fetchWorkOrdersQuery,
} from '../lib/pmQueries';
import { isApproved } from '../lib/approvalStatus';
import { toUserFacingError } from '../lib/userFacingError';
import AlertsBell from './AlertsBell';

interface DashboardProps {
  onNavigateToTenant?: (tenantName: string) => void;
  onNavigateToWorkOrder?: (workOrderId: string) => void;
  onNavigateToTechnicians?: () => void;
  onNavigateToTenants?: () => void;
}

const Dashboard = ({
  onNavigateToTenant,
  onNavigateToWorkOrder,
  onNavigateToTechnicians,
  onNavigateToTenants,
}: DashboardProps) => {
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

  const { data: userName = 'Admin' } = useQuery({
    queryKey: queryKeys.currentUserName,
    queryFn: fetchCurrentUserName,
  });

  const {
    data: adminStats,
    isLoading: loadingAdminStats,
  } = useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: fetchAdminStatsQuery,
    enabled: !isPM,
  });

  const {
    data: allWorkOrders = [],
    isLoading: loadingWorkOrders,
    error: workOrdersQueryError,
  } = useQuery({
    queryKey: queryKeys.workOrders,
    queryFn: fetchWorkOrdersQuery,
    enabled: isPM,
  });

  const {
    data: tenantsData,
    isLoading: loadingTenants,
    error: tenantsQueryError,
  } = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: fetchTenantsQuery,
    enabled: isPM,
  });

  const workOrders = useMemo(() => allWorkOrders.slice(0, 3), [allWorkOrders]);
  const pmStats = useMemo(() => derivePmWorkOrderStats(allWorkOrders), [allWorkOrders]);
  const recentTenants = useMemo(
    () => (tenantsData?.tenants ?? []).slice(0, 5),
    [tenantsData?.tenants]
  );

  if (workOrdersQueryError) {
    console.error('Failed to load work orders:', workOrdersQueryError)
  }
  if (tenantsQueryError) {
    console.error('Failed to load tenants:', tenantsQueryError)
  }

  const errorWorkOrders = workOrdersQueryError
    ? toUserFacingError(workOrdersQueryError, 'Unable to load work orders. Please try again.')
    : null;

  const errorTenants = tenantsQueryError
    ? toUserFacingError(tenantsQueryError, 'Unable to load tenants. Please try again.')
    : null;

  // Overview cards for Super Admin
  const adminOverviewCards = [
    {
      title: 'Active PMs',
      value: loadingAdminStats ? '—' : (adminStats?.activePMs ?? 0).toString(),
      subtitle: 'Across all regions',
      icon: Users,
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
    },
    {
      title: 'Assigned Properties',
      value: loadingAdminStats ? '—' : (adminStats?.assignedProperties ?? 0).toString(),
      subtitle: 'Managed portfolio',
      icon: Building2,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
    },
    {
      title: 'Pending Invites',
      value: '5',
      subtitle: 'Awaiting acceptance',
      icon: Mail,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
  ];

  const pmOverviewCards = [
    {
      title: 'Pending',
      value: loadingWorkOrders && allWorkOrders.length === 0 ? '—' : pmStats.pending.toString(),
      subtitle: 'Awaiting assignment',
      icon: ClipboardList,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      title: 'In Progress',
      value: loadingWorkOrders && allWorkOrders.length === 0 ? '—' : pmStats.inProgress.toString(),
      subtitle: 'Technician working',
      icon: Wrench,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
    },
    {
      title: 'Completed',
      value: loadingWorkOrders && allWorkOrders.length === 0 ? '—' : pmStats.completed.toString(),
      subtitle: 'Last 30 days',
      icon: CheckCircle,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
  ];

  const overviewCards = isPM ? pmOverviewCards : adminOverviewCards;

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
      <div className="relative overflow-hidden bg-white rounded-xl shadow-sm">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-52 h-52 bg-teal-100/40 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-60 h-60 bg-teal-100/30 rounded-full blur-3xl" />
        <div
          className="pointer-events-none absolute top-8 right-10 w-28 h-16 opacity-40"
          style={{ backgroundImage: 'radial-gradient(#99f6e4 1.5px, transparent 1.5px)', backgroundSize: '10px 10px' }}
        />
        <div
          className="pointer-events-none absolute bottom-8 left-10 w-28 h-16 opacity-40"
          style={{ backgroundImage: 'radial-gradient(#99f6e4 1.5px, transparent 1.5px)', backgroundSize: '10px 10px' }}
        />

        {/* Search */}
        <div className="relative px-6 pt-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={isPM ? "Search tenants, technicians, properties…" : "Search PMs, properties…"}
              className="block w-full pl-10 pr-3 py-2 bg-gray-50 border-0 rounded-full text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="relative px-6 pb-6 pt-4">
          {/* Welcome Message + Alerts */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome, {userName}!
              </h1>
              <p className="text-gray-600">
                Here's an overview of your management dashboard
              </p>
            </div>

            {isPM && onNavigateToWorkOrder && onNavigateToTechnicians && onNavigateToTenants && (
              <AlertsBell
                className="shrink-0"
                onNavigateToWorkOrder={onNavigateToWorkOrder}
                onNavigateToTechnicians={onNavigateToTechnicians}
                onNavigateToTenants={onNavigateToTenants}
              />
            )}
          </div>

      {/* Overview Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">Overview</h2>
        
        {/* Time Period Dropdown */}
        <div className="relative">
          <select className="appearance-none bg-white border border-teal-600 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {overviewCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${card.iconBg}`}>
                <Icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{card.title}</h3>
                  <p className="text-sm text-gray-400">{card.subtitle}</p>
                </div>
                <span className="text-3xl font-bold text-gray-900">{card.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* PM Dashboard: Work Orders and Users */}
      {isPM ? (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Work Orders Section */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
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
                  <p className="text-gray-500">No work orders found for the selected period.</p>
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
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Tenants</h3>
            </div>

            {/* Tenants Table */}
            <div className="overflow-x-auto">
              {loadingTenants ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading tenants...</p>
                </div>
              ) : errorTenants ? (
                <div className="text-center py-8">
                  <p className="text-red-500">{errorTenants}</p>
                </div>
              ) : recentTenants.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No tenants found for the selected property.</p>
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
                    {recentTenants.map((user) => {
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
                              isApproved(user.approved) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {isApproved(user.approved) ? '✓ Approved' : '✗ Not Approved'}
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="text-center py-12">
            <p className="text-gray-500">No recent activity to display</p>
            <p className="text-sm text-gray-400 mt-2">Activity will appear here as it happens</p>
          </div>
        </div>
      </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
