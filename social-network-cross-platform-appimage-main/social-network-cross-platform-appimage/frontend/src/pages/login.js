import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); }
    catch (err) { setError(err.response?.data?.error || 'Invalid email or password'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md anim-fade">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/25 shadow-lg">
            <span className="text-2xl font-black text-white">E</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">EduNet</h1>
          <p className="text-blue-200 dark:text-blue-300 mt-1 text-sm">Connect with people around you</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 mb-6">Welcome back</h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-5 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="you@example.com" required autoFocus />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="input pr-10" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="btn btn-primary btn-lg w-full mt-2">
              {loading ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Signing in…</> : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="link">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}