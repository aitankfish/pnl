import { Card, CardContent } from '@/components/ui/card';

export default function WalletLoading() {
  return (
    <div className="min-h-screen p-6 animate-pulse">
      {/* Profile & Balance Section */}
      <div className="max-w-5xl mx-auto mb-8">
        {/* Balance Display */}
        <div className="text-center mb-6 space-y-3">
          <div className="h-14 bg-white/10 rounded-lg w-64 mx-auto"></div>
          <div className="h-7 bg-white/5 rounded-lg w-48 mx-auto"></div>
          <div className="h-4 bg-white/5 rounded-lg w-32 mx-auto"></div>
        </div>

        {/* Username + Action Buttons */}
        <div className="flex items-center justify-center space-x-2 mb-8">
          <div className="w-14 h-14 bg-white/10 rounded-full"></div>
          <div className="h-9 bg-white/10 rounded w-40"></div>
          <div className="h-9 bg-white/10 rounded w-24"></div>
          <div className="h-9 bg-white/10 rounded w-24"></div>
          <div className="h-9 bg-white/10 rounded w-24"></div>
          <div className="h-9 bg-white/10 rounded w-24"></div>
          <div className="h-9 bg-white/10 rounded w-24"></div>
        </div>
      </div>

      {/* Tokens List */}
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white/10 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-5 bg-white/10 rounded w-24"></div>
                  <div className="h-4 bg-white/5 rounded w-32"></div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="h-5 bg-white/10 rounded w-24"></div>
                <div className="h-4 bg-white/5 rounded w-20"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Predictions Skeleton */}
        <div className="space-y-4">
          <div className="h-7 bg-white/10 rounded w-48"></div>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6">
              <div className="text-center space-y-2 py-8">
                <div className="h-4 bg-white/5 rounded w-48 mx-auto"></div>
                <div className="h-3 bg-white/5 rounded w-64 mx-auto"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
