import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function CreateLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-10 w-64 bg-white/10 rounded animate-pulse"></div>
        <div className="h-6 w-full max-w-2xl bg-white/5 rounded animate-pulse"></div>
      </div>

      {/* Form Skeleton */}
      <Card className="bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <div className="h-8 w-48 bg-white/10 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Form fields skeleton */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-32 bg-white/10 rounded animate-pulse"></div>
              <div className="h-12 w-full bg-white/10 rounded animate-pulse"></div>
            </div>
          ))}

          {/* Submit button skeleton */}
          <div className="h-12 w-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    </div>
  );
}
