import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ArrowUp, Check, Clock, Minus } from 'lucide-react';
import InvitePM from './InvitePM';
import { getAuthenticatedSupabase } from '../lib/supabase';

interface PropertyManager {
  id: string;
  name: string;
  email: string;
  avatar: string;
  assignedProperties: string[];
  region: string;
  status: 'Active' | 'Invite Sent' | 'Deactivated';
}

const PropertyManagers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('Any');
  const [showInvitePM, setShowInvitePM] = useState(false);
  const [propertyManagers, setPropertyManagers] = useState<PropertyManager[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBulkInviteClick = () => {
    setShowInvitePM(true);
  };

  useEffect(() => {
    const fetchPropertyManagers = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabaseClient = getAuthenticatedSupabase();

        const { data: pmData, error: pmError } = await supabaseClient
          .from('users')
          .select('id, name, email, approved, property_name')
          .eq('role', 'pm')
          .order('created_at', { ascending: false });

        if (pmError) {
          throw pmError;
        }

        let propertiesData: Array<{ id: string; name: string | null; pm_id: string | null; region?: string | null }> =
          [];

        const { data: propsData, error: propsError } = await supabaseClient
          .from('properties')
          .select('id, name, pm_id, region');

        if (propsError) {
          console.warn('Failed to fetch properties for PMs:', propsError);
        } else if (propsData) {
          propertiesData = propsData;
        }

        const propertyMap = propertiesData.reduce(
          (acc, property) => {
            if (!property.pm_id) return acc;
            if (!acc[property.pm_id]) {
              acc[property.pm_id] = [];
            }
            acc[property.pm_id].push({
              name: property.name ?? 'Unnamed Property',
              region: property.region ?? 'Unassigned',
            });
            return acc;
          },
          {} as Record<string, Array<{ name: string; region: string }>>,
        );

        const transformed: PropertyManager[] =
          pmData?.map((pm: any) => {
            const assignedProps = propertyMap[pm.id] ?? [];
            const assignedProperties =
              assignedProps.length > 0
                ? assignedProps.map((property) => property.name)
                : pm.property_name
                ? [pm.property_name]
                : [];

            const region =
              assignedProps.find((property) => property.region && property.region !== 'Unassigned')?.region ??
              (assignedProps[0]?.region ?? 'Unassigned');

            const status =
              pm.approved === true ? 'Active' : pm.approved === false ? 'Deactivated' : 'Invite Sent';

            const avatarSource =
              pm.avatar_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(pm.name || pm.email || 'PM')}&background=0f766e&color=ffffff`;

            return {
              id: pm.id,
              name: pm.name || 'Unnamed Property Manager',
              email: pm.email || 'N/A',
              avatar: avatarSource,
              assignedProperties,
              region,
              status,
            } as PropertyManager;
          }) ?? [];

        setPropertyManagers(transformed);
      } catch (fetchError: any) {
        console.error('Error fetching property managers:', fetchError);
        setError(fetchError?.message || 'Failed to load property managers.');
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyManagers();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <Check className="w-3 h-3" />;
      case 'Invite Sent':
        return <Clock className="w-3 h-3" />;
      case 'Deactivated':
        return <Minus className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500 text-white';
      case 'Invite Sent':
        return 'bg-orange-500 text-white';
      case 'Deactivated':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const regionOptions = useMemo(() => {
    const uniqueRegions = new Set<string>();
    propertyManagers.forEach((manager) => {
      if (manager.region && manager.region !== 'Unassigned') {
        uniqueRegions.add(manager.region);
      }
    });

    const options = ['Any'];
    options.push(...Array.from(uniqueRegions));
    if (!uniqueRegions.size) {
      options.push('Unassigned');
    }
    return options;
  }, [propertyManagers]);

  const filteredManagers = propertyManagers.filter((manager) => {
    const matchesSearch =
      manager.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || manager.status === statusFilter;
    const matchesRegion =
      regionFilter === 'Any' || manager.region === regionFilter || (regionFilter === 'Unassigned' && manager.region === 'Unassigned');

    return matchesSearch && matchesStatus && matchesRegion;
  });

  // Show InvitePM component if showInvitePM is true
  if (showInvitePM) {
    return <InvitePM onBack={() => setShowInvitePM(false)} />;
  }

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Property Managers</h1>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white w-64"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="All">Status: All</option>
              <option value="Active">Active</option>
              <option value="Invite Sent">Invite Sent</option>
              <option value="Deactivated">Deactivated</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Region Filter */}
          <div className="relative">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {regionOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'Any' ? 'Region: Any' : option}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Bulk Invite Button */}
          <button 
            disabled
            className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-not-allowed"
          >
            <ArrowUp className="w-4 h-4" />
            Bulk Invite
          </button>
        </div>
      </div>

      {/* Property Managers Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading property managers...</div>
          ) : error ? (
            <div className="py-12 text-center text-red-500">{error}</div>
          ) : filteredManagers.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No property managers found.</div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">PM</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Assigned Properties</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Region</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredManagers.map((manager) => (
                <tr key={manager.id} className="hover:bg-gray-50">
                  {/* PM Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img
                        src={manager.avatar}
                        alt={manager.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{manager.name}</div>
                        <div className="text-sm text-gray-500">{manager.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Assigned Properties Column */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {manager.assignedProperties.length > 0 ? (
                        manager.assignedProperties.map((property, index) => (
                          <div key={index}>{property}</div>
                        ))
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>

                  {/* Region Column */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{manager.region}</div>
                  </td>

                  {/* Status Column */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(manager.status)}`}>
                      {getStatusIcon(manager.status)}
                      {manager.status}
                    </span>
                  </td>

                  {/* Actions Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {manager.status === 'Active' && (
                        <>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            View
                          </button>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            Reset Password
                          </button>
                          <button className="px-3 py-1 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors">
                            Deactivate
                          </button>
                        </>
                      )}
                      {manager.status === 'Invite Sent' && (
                        <>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            Resend Invite
                          </button>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            Edit
                          </button>
                          <button className="px-3 py-1 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors">
                            Deactivate
                          </button>
                        </>
                      )}
                      {manager.status === 'Deactivated' && (
                        <>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            View
                          </button>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            Reactivate
                          </button>
                          <button className="px-3 py-1 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors">
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyManagers;
