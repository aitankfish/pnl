export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-400 mb-8">Page not found</p>
        <a href="/" className="text-blue-500 hover:text-blue-400 underline">
          Return Home
        </a>
      </div>
    </div>
  );
}
