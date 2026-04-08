export default function LaunchedLoading() {
  return (
    <div className="p-6 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="text-center space-y-4">
        <div className="h-10 bg-white/10 rounded-lg w-96 mx-auto"></div>
        <div className="h-6 bg-white/5 rounded-lg w-[500px] mx-auto"></div>
      </div>

      {/* Projects Grid Skeleton */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-9 bg-white/10 rounded-lg w-48"></div>
          <div className="flex items-center space-x-2">
            <div className="h-5 w-5 bg-white/10 rounded"></div>
            <div className="h-5 bg-white/10 rounded w-40"></div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6 space-y-4">
              {/* Header */}
              <div className="flex items-start space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-white/10 rounded w-32"></div>
                  <div className="flex space-x-2">
                    <div className="h-5 bg-white/10 rounded w-16"></div>
                    <div className="h-5 bg-white/10 rounded w-16"></div>
                  </div>
                </div>
              </div>
              <div className="h-12 bg-white/10 rounded"></div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="h-16 bg-white/10 rounded-lg"></div>
                <div className="h-16 bg-white/10 rounded-lg"></div>
                <div className="h-16 bg-white/10 rounded-lg"></div>
                <div className="h-16 bg-white/10 rounded-lg"></div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="h-5 bg-white/10 rounded"></div>
                <div className="h-5 bg-white/10 rounded"></div>
                <div className="h-5 bg-white/10 rounded"></div>
                <div className="h-5 bg-white/10 rounded"></div>
              </div>

              {/* Token Address */}
              <div className="h-12 bg-white/10 rounded-lg"></div>

              {/* Buttons */}
              <div className="flex gap-2">
                <div className="h-9 bg-white/10 rounded flex-1"></div>
                <div className="h-9 bg-white/10 rounded flex-1"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Skeleton */}
      <div className="text-center space-y-6 py-12">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="h-9 bg-white/10 rounded-lg w-96 mx-auto"></div>
          <div className="h-6 bg-white/5 rounded-lg w-[500px] mx-auto"></div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="h-12 bg-white/10 rounded w-48"></div>
            <div className="h-12 bg-white/10 rounded w-48"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
