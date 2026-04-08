export default function NotificationsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-9 bg-white/10 rounded-lg w-48"></div>
        <div className="h-5 bg-white/5 rounded-lg w-96"></div>
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex space-x-2 border-b border-white/10 pb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-white/10 rounded-lg w-24"></div>
        ))}
      </div>

      {/* Notifications List Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-start space-x-4">
              {/* Icon */}
              <div className="w-10 h-10 bg-white/10 rounded-full flex-shrink-0"></div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-white/10 rounded w-3/4"></div>
                    <div className="h-4 bg-white/5 rounded w-full"></div>
                  </div>
                  <div className="h-4 bg-white/10 rounded w-20 ml-4"></div>
                </div>

                {/* Badge */}
                <div className="h-6 bg-white/10 rounded w-24"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
