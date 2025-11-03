import { useState, useEffect } from 'react';
import { Search, Wrench, Mail } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';

interface Technician {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  approved: boolean | null;
  created_at?: string;
}

const Technicians = () => {
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

  // State for technicians
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [errorTechnicians, setErrorTechnicians] = useState<string | null>(null);

  // State for search
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch technicians from database
  useEffect(() => {
    if (!isPM) return; // Only fetch for PM users

    const fetchTechnicians = async () => {
      setLoadingTechnicians(true);
      setErrorTechnicians(null);

      try {
        const supabaseClient = getAuthenticatedSupabase();
        
        console.log('Fetching technicians for PM...');
        
        // Get PM's property_id
        const { data: userData } = await supabaseClient.auth.getUser();
        
        if (!userData.user) {
          throw new Error('User not found');
        }

        const { data: pmData, error: pmError } = await supabaseClient
          .from('users')
          .select('property_id')
          .eq('id', userData.user.id)
          .eq('role', 'pm')
          .single();

        if (pmError) throw pmError;
        if (!pmData.property_id) {
          console.log('No property assigned to PM');
          setTechnicians([]);
          return;
        }

        // Fetch all technicians from the same property
        const { data: techniciansData, error: techniciansError } = await supabaseClient
          .from('users')
          .select('id, name, email, role, approved, created_at')
          .eq('property_id', pmData.property_id)
          .eq('role', 'technician')
          .order('created_at', { ascending: false });

        if (techniciansError) throw techniciansError;

        console.log('Technicians fetched:', techniciansData);

        if (!techniciansData || techniciansData.length === 0) {
          console.log('No technicians found in database');
          setTechnicians([]);
          return;
        }

        const transformedData: Technician[] = techniciansData.map((technician: any) => ({
          id: technician.id,
          name: technician.name,
          email: technician.email,
          role: technician.role,
          approved: technician.approved,
          created_at: technician.created_at,
        }));

        setTechnicians(transformedData);
      } catch (err: any) {
        console.error('Error fetching technicians:', err);
        setErrorTechnicians(err.message || 'Failed to load technicians');
      } finally {
        setLoadingTechnicians(false);
      }
    };

    fetchTechnicians();
  }, [isPM]);

  // Filter technicians based on search
  const filteredTechnicians = technicians.filter((technician) => {
    const matchesSearch = 
      technician.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      technician.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Technicians</h1>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search technicians..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Technicians Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loadingTechnicians ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading technicians...</p>
          </div>
        ) : errorTechnicians ? (
          <div className="text-center py-12">
            <p className="text-red-500">{errorTechnicians}</p>
          </div>
        ) : filteredTechnicians.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {technicians.length === 0 ? 'No technicians found' : 'No technicians match your filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Technician</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Date Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTechnicians.map((technician) => (
                  <tr key={technician.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                          <Wrench className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {technician.name || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        {technician.email || 'N/A'}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {formatDate(technician.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Technicians;
