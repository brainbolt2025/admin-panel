import { useState, useEffect, type FC } from 'react';
import { Search, ChevronDown, Clock, Sun, CheckCircle, AlertTriangle, Flame, Shield, UserPlus, Wrench, X } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';
import { usePendingWorkOrders } from '../context/PendingWorkOrdersContext';

interface WorkOrder {
  id: string;
  title: string | null;
  description: string | null;
  priority: 'Low' | 'Medium' | 'High' | null;
  status: string | null;
  property_name?: string;
  tenant_name?: string;
  tenant_id?: string;
  property_id?: string;
  technician_id?: string;
}

interface Technician {
  id: string;
  name: string;
  email: string;
}

export interface WorkOrdersProps {
  selectedWorkOrderId?: string | null;
  onClearSelectedWorkOrder: () => void;
}

const WorkOrders: FC<WorkOrdersProps> = ({ selectedWorkOrderId, onClearSelectedWorkOrder }) => {
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

  // State for work orders
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);
  const [errorWorkOrders, setErrorWorkOrders] = useState<string | null>(null);

  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // State for assign modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // State for view technician dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [assignedTechnician, setAssignedTechnician] = useState<Technician | null>(null);
  const [loadingAssignedTechnician, setLoadingAssignedTechnician] = useState(false);

  const { setPendingCount } = usePendingWorkOrders();
  useEffect(() => {
    const pendingCount = workOrders.filter((order) => order.status === 'Pending').length;
    setPendingCount(pendingCount);
  }, [workOrders, setPendingCount]);

  // Fetch all work orders from database (not just 3)
  useEffect(() => {
    if (!isPM) return; // Only fetch for PM users

    const fetchWorkOrders = async () => {
      setLoadingWorkOrders(true);
      setErrorWorkOrders(null);

      try {
        const supabaseClient = getAuthenticatedSupabase();
        
        console.log('Fetching all work orders...');
        
        // Fetch all work orders (no limit for PM)
        const { data: ordersData, error: ordersError } = await supabaseClient
          .from('work_orders')
          .select('id, title, description, priority, status, tenant_name, tenant_id, property_id, technician_id')
          .order('id', { ascending: false });

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
          tenant_id: order.tenant_id,
          property_id: order.property_id,
          technician_id: order.technician_id,
        }));

        setWorkOrders(transformedData);
      } catch (err: any) {
        console.error('Error fetching work orders:', err);
        setErrorWorkOrders(err.message || 'Failed to load work orders');
      } finally {
        setLoadingWorkOrders(false);
      }
    };

    fetchWorkOrders();
  }, [isPM]);

  // Effect to handle selectedWorkOrderId from Dashboard or Topbar
  useEffect(() => {
    if (selectedWorkOrderId && workOrders.length > 0) {
      const workOrder = workOrders.find(wo => wo.id === selectedWorkOrderId);
      if (workOrder) {
        setSearchTerm(workOrder.title || '');
        // Clear the selected ID after a delay to allow sorting to complete
        setTimeout(() => {
          onClearSelectedWorkOrder();
        }, 100);
      }
    }
  }, [selectedWorkOrderId, workOrders, onClearSelectedWorkOrder]);

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
      case 'Canceled':
        return { icon: AlertTriangle, color: 'bg-red-100 text-red-700' };
      default:
        return { icon: Clock, color: 'bg-gray-100 text-gray-700' };
    }
  };

  // Filter work orders based on search and filters
  const filteredWorkOrders = workOrders
    .filter((order) => {
      const matchesSearch = 
        order.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      const matchesPriority = priorityFilter === 'All' || order.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      // If there's a selected work order ID, prioritize it
      if (selectedWorkOrderId) {
        if (a.id === selectedWorkOrderId) return -1;
        if (b.id === selectedWorkOrderId) return 1;
      }
      
      // If there's a search term, prioritize exact or close matches
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const aTitleMatch = a.title?.toLowerCase().startsWith(searchLower) ? 1 : 0;
        const bTitleMatch = b.title?.toLowerCase().startsWith(searchLower) ? 1 : 0;
        
        // Exact start matches first
        if (aTitleMatch !== bTitleMatch) {
          return bTitleMatch - aTitleMatch;
        }
        
        // Then exact title matches
        const aExactMatch = a.title?.toLowerCase() === searchLower ? 1 : 0;
        const bExactMatch = b.title?.toLowerCase() === searchLower ? 1 : 0;
        if (aExactMatch !== bExactMatch) {
          return bExactMatch - aExactMatch;
        }
      }
      
      // Default: sort by ID descending (newest first)
      return parseInt(b.id) - parseInt(a.id);
    });

  // Handle assign button click
  const handleAssignClick = async (workOrder: WorkOrder) => {
    if (!workOrder.property_id) {
      alert('This work order is not associated with a property');
      return;
    }

    setSelectedWorkOrder(workOrder);
    setAssignModalOpen(true);
    setLoadingTechnicians(true);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Fetch technicians from the same property
      const { data, error } = await supabaseClient
        .from('users')
        .select('id, name, email')
        .eq('property_id', workOrder.property_id)
        .eq('role', 'technician');

      if (error) throw error;

      setTechnicians(data || []);
    } catch (err: any) {
      console.error('Error fetching technicians:', err);
      alert('Failed to load technicians. Please try again.');
      setAssignModalOpen(false);
    } finally {
      setLoadingTechnicians(false);
    }
  };

  // Handle assign submit
  const handleAssignSubmit = async () => {
    if (!selectedWorkOrder || !selectedTechnician) {
      alert('Please select a technician');
      return;
    }

    setAssigning(true);
    
    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Update the work order with assigned technician
      // Only change status to In Progress if it's currently Pending (for Assign)
      // If it's already In Progress (for Reassign), keep the status
      const updateData: any = { technician_id: selectedTechnician };
      if (selectedWorkOrder.status === 'Pending') {
        updateData.status = 'In Progress';
      }
      
      const { error } = await supabaseClient
        .from('work_orders')
        .update(updateData)
        .eq('id', selectedWorkOrder.id);

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      // Refresh work orders list
      const { data: ordersData, error: ordersError } = await supabaseClient
        .from('work_orders')
        .select('id, title, description, priority, status, tenant_name, tenant_id, property_id, technician_id')
        .order('id', { ascending: false });

      if (ordersError) throw ordersError;

      const transformedData: WorkOrder[] = ordersData.map((order: any) => ({
        id: order.id,
        title: order.title || order.description || 'Untitled',
        description: order.description,
        priority: order.priority as 'Low' | 'Medium' | 'High' | null,
        status: order.status,
        tenant_name: order.tenant_name || 'N/A',
        tenant_id: order.tenant_id,
        property_id: order.property_id,
        technician_id: order.technician_id,
      }));

      setWorkOrders(transformedData);

      // Close modal and reset
      setAssignModalOpen(false);
      setSelectedWorkOrder(null);
      setSelectedTechnician(null);
      setTechnicians([]);
    } catch (err: any) {
      console.error('Error assigning work order:', err);
      alert('Failed to assign work order. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  // Close assign modal
  const handleCloseAssignModal = () => {
    setAssignModalOpen(false);
    setSelectedWorkOrder(null);
    setSelectedTechnician(null);
    setTechnicians([]);
  };

  // Handle view technician button click
  const handleViewClick = async (workOrder: WorkOrder) => {
    if (!workOrder.technician_id) {
      alert('No technician assigned to this work order');
      return;
    }

    setSelectedWorkOrder(workOrder);
    setViewDialogOpen(true);
    setLoadingAssignedTechnician(true);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Fetch technician information
      const { data, error } = await supabaseClient
        .from('users')
        .select('id, name, email')
        .eq('id', workOrder.technician_id)
        .single();

      if (error) throw error;

      setAssignedTechnician(data);
    } catch (err: any) {
      console.error('Error fetching technician:', err);
      alert('Failed to load technician information. Please try again.');
      setViewDialogOpen(false);
    } finally {
      setLoadingAssignedTechnician(false);
    }
  };

  // Close view technician dialog
  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setSelectedWorkOrder(null);
    setAssignedTechnician(null);
  };

  // Handle reopen button click
  const handleReopenClick = async (workOrder: WorkOrder) => {
    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Update the work order status to In Progress
      const { error } = await supabaseClient
        .from('work_orders')
        .update({ status: 'In Progress' })
        .eq('id', workOrder.id);

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      // Refresh work orders list
      const { data: ordersData, error: ordersError } = await supabaseClient
        .from('work_orders')
        .select('id, title, description, priority, status, tenant_name, tenant_id, property_id, technician_id')
        .order('id', { ascending: false });

      if (ordersError) throw ordersError;

      const transformedData: WorkOrder[] = ordersData.map((order: any) => ({
        id: order.id,
        title: order.title || order.description || 'Untitled',
        description: order.description,
        priority: order.priority as 'Low' | 'Medium' | 'High' | null,
        status: order.status,
        tenant_name: order.tenant_name || 'N/A',
        tenant_id: order.tenant_id,
        property_id: order.property_id,
        technician_id: order.technician_id,
      }));

      setWorkOrders(transformedData);
    } catch (err: any) {
      console.error('Error reopening work order:', err);
      alert('Failed to reopen work order. Please try again.');
    }
  };

  // Handle complete button click
  const handleCompleteClick = async (workOrder: WorkOrder) => {
    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Update the work order status to Completed
      const { error } = await supabaseClient
        .from('work_orders')
        .update({ status: 'Completed' })
        .eq('id', workOrder.id);

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      // Refresh work orders list
      const { data: ordersData, error: ordersError } = await supabaseClient
        .from('work_orders')
        .select('id, title, description, priority, status, tenant_name, tenant_id, property_id, technician_id')
        .order('id', { ascending: false });

      if (ordersError) throw ordersError;

      const transformedData: WorkOrder[] = ordersData.map((order: any) => ({
        id: order.id,
        title: order.title || order.description || 'Untitled',
        description: order.description,
        priority: order.priority as 'Low' | 'Medium' | 'High' | null,
        status: order.status,
        tenant_name: order.tenant_name || 'N/A',
        tenant_id: order.tenant_id,
        property_id: order.property_id,
        technician_id: order.technician_id,
      }));

      setWorkOrders(transformedData);
    } catch (err: any) {
      console.error('Error completing work order:', err);
      alert('Failed to complete work order. Please try again.');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Work Orders</h1>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search work orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none w-full bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="All">Status: All</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Canceled">Canceled</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative flex-1">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="appearance-none w-full bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="All">Priority: All</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loadingWorkOrders ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading work orders...</p>
          </div>
        ) : errorWorkOrders ? (
          <div className="text-center py-12">
            <p className="text-red-500">{errorWorkOrders}</p>
          </div>
        ) : filteredWorkOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {workOrders.length === 0 ? 'No work orders found' : 'No work orders match your filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Title</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Tenant</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Priority</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredWorkOrders.map((order) => {
                  const PriorityIcon = getPriorityIcon(order.priority);
                  const { icon: StatusIcon, color: statusColor } = getStatusInfo(order.status);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="text-sm font-medium text-gray-900">{order.title}</div>
                        {order.description && (
                          <div className="text-xs text-gray-500 mt-1">{order.description}</div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">{order.tenant_name}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                          <PriorityIcon className="w-3 h-3" />
                          {order.priority || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${statusColor}`}>
                          <StatusIcon className="w-3 h-3" />
                          {order.status || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          {order.status === 'Pending' && (
                            <>
                              <button 
                                onClick={() => handleAssignClick(order)}
                                className="inline-flex items-center gap-1 text-xs px-3 py-1 text-teal-600 hover:bg-teal-50 rounded transition-colors"
                              >
                                <UserPlus className="w-3 h-3" />
                                Assign
                              </button>
                              <button 
                                onClick={() => handleViewClick(order)}
                                className="text-xs px-3 py-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                              >
                                Details
                              </button>
                            </>
                          )}
                          {order.status === 'In Progress' && (
                            <>
                              <button 
                                onClick={() => handleAssignClick(order)}
                                className="inline-flex items-center gap-1 text-xs px-3 py-1 text-teal-600 hover:bg-teal-50 rounded transition-colors"
                              >
                                <UserPlus className="w-3 h-3" />
                                Reassign
                              </button>
                              <button 
                                onClick={() => handleViewClick(order)}
                                className="text-xs px-3 py-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                              >
                                Details
                              </button>
                              <button 
                                onClick={() => handleCompleteClick(order)}
                                className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-green-600 text-white hover:bg-green-700 rounded transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Complete
                              </button>
                            </>
                          )}
                          {(order.status === 'Completed' || order.status === 'Canceled') && (
                            <>
                              <button className="text-xs px-3 py-1 text-gray-600 hover:bg-gray-50 rounded transition-colors">View</button>
                              <button 
                                onClick={() => handleReopenClick(order)}
                                className="text-xs px-3 py-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                              >
                                Reopen
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Technician Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Assign Technician</h2>
              <button
                onClick={handleCloseAssignModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Work Order Info */}
            {selectedWorkOrder && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{selectedWorkOrder.title}</p>
                {selectedWorkOrder.description && (
                  <p className="text-xs text-gray-600 mt-1">{selectedWorkOrder.description}</p>
                )}
              </div>
            )}

            {/* Loading State */}
            {loadingTechnicians ? (
              <div className="py-8 text-center">
                <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-500 text-sm">Loading technicians...</p>
              </div>
            ) : technicians.length === 0 ? (
              <div className="py-8 text-center">
                <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No technicians available</p>
                <p className="text-sm text-gray-400 mt-1">Please add technicians to this property first</p>
              </div>
            ) : (
              <>
                {/* Technician List */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Technician
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {technicians.map((technician) => (
                      <label
                        key={technician.id}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedTechnician === technician.id
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="technician"
                          value={technician.id}
                          checked={selectedTechnician === technician.id}
                          onChange={(e) => setSelectedTechnician(e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex items-center flex-1">
                          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                            <Wrench className="w-5 h-5 text-teal-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{technician.name}</p>
                            <p className="text-xs text-gray-500">{technician.email}</p>
                          </div>
                          {selectedTechnician === technician.id && (
                            <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleCloseAssignModal}
                    disabled={assigning}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignSubmit}
                    disabled={assigning || !selectedTechnician}
                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {assigning ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Assigning...
                      </>
                    ) : (
                      'Assign'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* View Technician Dialog */}
      {viewDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Technician Information</h2>
              <button
                onClick={handleCloseViewDialog}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Work Order Info */}
            {selectedWorkOrder && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{selectedWorkOrder.title}</p>
                {selectedWorkOrder.description && (
                  <p className="text-xs text-gray-600 mt-1">{selectedWorkOrder.description}</p>
                )}
              </div>
            )}

            {/* Loading State */}
            {loadingAssignedTechnician ? (
              <div className="py-8 text-center">
                <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-500 text-sm">Loading technician information...</p>
              </div>
            ) : assignedTechnician ? (
              <div className="space-y-4">
                {/* Technician Info Card */}
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center mb-4">
                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mr-4">
                      <Wrench className="w-8 h-8 text-teal-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-semibold text-gray-900">{assignedTechnician.name}</p>
                      <p className="text-sm text-gray-500">Technician</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-700 w-20">Email:</span>
                        <span className="text-sm text-gray-900">{assignedTechnician.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No technician information available</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCloseViewDialog}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrders;

