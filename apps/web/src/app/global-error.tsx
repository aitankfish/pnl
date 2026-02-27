'use client';

export const dynamic = 'force-dynamic';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <div className="text-center">
            <h1 className="text-6xl font-bold mb-4">Error</h1>
            <p className="text-xl text-gray-400 mb-8">Something went wrong</p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
