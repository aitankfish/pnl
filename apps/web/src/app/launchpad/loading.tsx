import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function LaunchpadLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-10 w-64 bg-white/10 rounded animate-pulse"></div>
        <div className="h-6 w-96 bg-white/5 rounded animate-pulse"></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-white/5 backdrop-blur-xl border-white/10 animate-pulse">
            <CardHeader>
              <div className="h-5 w-32 bg-white/10 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-10 w-24 bg-white/10 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Featured Markets Skeleton */}
      <div className="space-y-4">
        <div className="h-8 w-48 bg-white/10 rounded animate-pulse"></div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-white/5 backdrop-blur-xl border-white/10 animate-pulse">
              <CardHeader>
                <div className="space-y-3">
                  <div className="h-48 bg-white/10 rounded-lg"></div>
                  <div className="h-6 bg-white/10 rounded w-3/4"></div>
                  <div className="h-4 bg-white/5 rounded w-full"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 bg-white/10 rounded w-20"></div>
                    <div className="h-4 bg-white/10 rounded w-20"></div>
                  </div>
                  <div className="h-2 bg-white/10 rounded w-full"></div>
                  <div className="h-10 bg-white/10 rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
