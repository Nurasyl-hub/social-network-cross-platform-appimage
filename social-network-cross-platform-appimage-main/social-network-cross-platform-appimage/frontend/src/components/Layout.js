import { useEffect } from 'react';
import Navbar from './Navbar';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';

export default function Layout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isPublic = ['/login', '/register'].includes(router.pathname);

  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    if (!loading && !user && !isPublic) router.push('/login');
    if (!loading && user && isPublic) router.push('/');
  }, [user, loading, isPublic]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isPublic) return <>{children}</>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}