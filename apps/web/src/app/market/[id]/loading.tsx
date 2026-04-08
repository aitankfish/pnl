import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MarketDetailsLoading() {
  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4 animate-pulse">
      {/* Back Button */}
      <div className="h-10 w-32 bg-white/10 rounded"></div>

      {/* Combined Header & Project Info Section */}
      <Card className="bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4 flex-1">
              {/* Project Image */}
              <div className="w-20 h-20 rounded-xl bg-white/10"></div>

              {/* Project Info */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="h-8 bg-white/10 rounded w-48"></div>
                  <div className="h-6 bg-white/10 rounded-full w-24"></div>
                </div>
                <div className="h-4 bg-white/5 rounded w-full"></div>
                <div className="h-4 bg-white/5 rounded w-3/4"></div>

                {/* Badges */}
                <div className="flex items-center flex-wrap gap-2">
                  <div className="h-7 bg-white/10 rounded-lg w-20"></div>
                  <div className="h-7 bg-white/10 rounded-lg w-16"></div>
                  <div className="h-7 bg-white/10 rounded-lg w-16"></div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Market Status and Trading Section - Side by Side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Market Status Card */}
        <Card className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-cyan-500/10 backdrop-blur-xl border-purple-400/30">
          <CardHeader className="pb-3">
            <CardTitle className="h-6 bg-white/10 rounded w-32"></CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Chart Skeleton */}
            <div className="h-64 bg-white/10 rounded-lg"></div>

            {/* Voting Stats */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="h-5 bg-white/10 rounded w-24"></div>
                <div className="h-5 bg-white/10 rounded w-24"></div>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3"></div>
              <div className="h-8 bg-white/10 rounded w-32 mx-auto"></div>
            </div>
          </CardContent>
        </Card>

        {/* Trading Section */}
        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <div className="h-7 bg-white/10 rounded w-40"></div>
            <div className="h-4 bg-white/5 rounded w-48"></div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Side Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="h-14 bg-white/10 rounded-lg"></div>
              <div className="h-14 bg-white/10 rounded-lg"></div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <div className="h-4 bg-white/10 rounded w-20"></div>
              <div className="h-14 bg-white/10 rounded-lg"></div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-white/10 rounded-lg"></div>
                ))}
              </div>
            </div>

            {/* Trade Summary */}
            <div className="p-4 bg-white/5 rounded-lg space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-white/10 rounded w-24"></div>
                  <div className="h-4 bg-white/10 rounded w-20"></div>
                </div>
              ))}
            </div>

            {/* Trade Button */}
            <div className="h-14 bg-gradient-to-r from-green-500/20 to-cyan-500/20 rounded"></div>

            {/* Market Info */}
            <div className="pt-4 border-t border-white/10">
              <div className="h-5 bg-white/10 rounded w-24 mb-3"></div>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="p-3 bg-white/5 rounded-lg space-y-2">
                    <div className="h-3 bg-white/10 rounded w-20"></div>
                    <div className="h-5 bg-white/10 rounded w-24"></div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Holders and Live Activity Feed - Side by Side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Live Activity Feed */}
        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <div className="h-6 bg-white/10 rounded w-40"></div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-white/10 rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-white/10 rounded w-32"></div>
                    <div className="h-3 bg-white/5 rounded w-24"></div>
                  </div>
                </div>
                <div className="h-6 bg-white/10 rounded w-20"></div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Market Holders */}
        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <div className="h-6 bg-white/10 rounded w-32"></div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-white/10 rounded-full"></div>
                  <div className="h-4 bg-white/10 rounded w-28"></div>
                </div>
                <div className="h-4 bg-white/10 rounded w-20"></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Project Details Section */}
      <Card className="bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <div className="h-7 bg-white/10 rounded w-40"></div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-start space-x-3 p-4 bg-white/5 rounded-lg">
                <div className="w-5 h-5 bg-white/10 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/10 rounded w-20"></div>
                  <div className="h-5 bg-white/10 rounded w-32"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
