export default function BrowseLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-9 bg-white/10 rounded-lg w-64"></div>
        <div className="h-5 bg-white/5 rounded-lg w-96"></div>
      </div>

      {/* Category Filter Skeleton */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-9 bg-white/10 rounded-full w-24"></div>
        ))}
      </div>

      {/* Markets Grid Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-white/10 rounded w-3/4"></div>
                <div className="flex space-x-2">
                  <div className="h-5 bg-white/10 rounded w-16"></div>
                  <div className="h-5 bg-white/10 rounded w-16"></div>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/10 rounded-xl"></div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="h-4 bg-white/5 rounded w-full"></div>
              <div className="h-4 bg-white/5 rounded w-5/6"></div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="h-2 bg-white/10 rounded-full w-full"></div>
              <div className="flex justify-between">
                <div className="h-3 bg-white/5 rounded w-16"></div>
                <div className="h-3 bg-white/5 rounded w-16"></div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 bg-white/10 rounded-lg"></div>
              <div className="h-16 bg-white/10 rounded-lg"></div>
            </div>

            {/* Timer */}
            <div className="h-12 bg-white/10 rounded-lg"></div>

            {/* Buttons */}
            <div className="flex gap-2">
              <div className="h-10 bg-white/10 rounded flex-1"></div>
              <div className="h-10 bg-white/10 rounded flex-1"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
