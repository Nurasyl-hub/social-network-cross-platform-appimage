import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-8xl font-extrabold text-gray-200 mb-4">404</div>
      <p className="text-gray-500 text-lg font-semibold mb-2">Page not found</p>
      <p className="text-gray-400 text-sm mb-8">The page you're looking for doesn't exist.</p>
      <Link href="/" className="btn btn-primary">Go Home</Link>
    </div>
  );
}
