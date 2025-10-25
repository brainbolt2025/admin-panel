import { ChevronDown } from 'lucide-react';

const Dashboard = () => {
  const overviewCards = [
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

  return (
    <div className="p-6">
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

      {/* Additional content area for future expansion */}
      <div className="mt-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="text-center py-12">
            <p className="text-gray-500">No recent activity to display</p>
            <p className="text-sm text-gray-400 mt-2">Activity will appear here as it happens</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
