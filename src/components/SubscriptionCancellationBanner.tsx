import { AlertTriangle } from 'lucide-react';

interface SubscriptionCancellationBannerProps {
  cancelAt: string | null;
}

const SubscriptionCancellationBanner = ({ cancelAt }: SubscriptionCancellationBannerProps) => {
  if (!cancelAt) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
      <div className="flex items-center space-x-3 max-w-7xl mx-auto">
        <div className="flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-yellow-800">
            Subscription Scheduled for Cancellation
          </p>
          <p className="text-sm text-yellow-700">
            Your subscription will be cancelled on <strong>{formatDate(cancelAt)}</strong>. 
            You'll continue to have access to all features until then.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCancellationBanner;

