import { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ email:'', password:'', first_name:'', last_name:'', date_of_birth:'', nickname:'', about_me:'' });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (avatar) fd.append('avatar', avatar);
      await register(fd);
    } catch (err) { setError(err.response?.data?.error || 'Registration failed'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg anim-fade">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/25 shadow-lg">
            <span className="text-2xl font-black text-white">E</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Join EduNet</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 mb-5">Create your account</h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-4 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {}
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
              <div onClick={() => fileRef.current.click()}
                className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 cursor-pointer overflow-hidden flex items-center justify-center transition-all shrink-0">
                {preview ? <img src={preview} className="w-full h-full object-cover" alt="" /> : <span className="text-2xl">👤</span>}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Profile Photo</p>
                <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">Optional — JPG, PNG, GIF</p>
                <button type="button" onClick={() => fileRef.current.click()} className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1">
                  {preview ? 'Change' : 'Upload'} photo
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.gif" hidden
                onChange={e => { const f = e.target.files[0]; if (f) { setAvatar(f); setPreview(URL.createObjectURL(f)); } }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First Name *</label>
                <input className="input" type="text" value={form.first_name} onChange={set('first_name')} placeholder="John" required />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input className="input" type="text" value={form.last_name} onChange={set('last_name')} placeholder="Doe" required />
              </div>
            </div>

            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
            </div>

            <div>
              <label className="label">Password *</label>
              <div className="relative">
                <input className="input pr-10" type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min 6 characters" minLength={6} required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">{showPass ? '🙈' : '👁'}</button>
              </div>
            </div>

            <div>
              <label className="label">Date of Birth *</label>
              <input className="input" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} required />
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Optional</p>
              <div className="space-y-3">
                <div>
                  <label className="label">Nickname</label>
                  <input className="input" type="text" value={form.nickname} onChange={set('nickname')} placeholder="@username" />
                </div>
                <div>
                  <label className="label">About Me</label>
                  <textarea className="input resize-none" rows={2} value={form.about_me} onChange={set('about_me')} placeholder="Tell us about yourself…" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
              {loading ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating…</> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
            Already have an account? <Link href="/login" className="link">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}