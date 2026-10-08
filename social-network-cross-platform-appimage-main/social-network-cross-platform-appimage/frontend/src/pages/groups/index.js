import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { API } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function Groups() {
  const toast = useToast();
  const [groups, setGroups]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [search, setSearch]     = useState('');

  useEffect(() => { fetchGroups(); }, []);

  const fetchGroups = async () => {
    try { const r = await axios.get(`${API}/api/groups`, { withCredentials: true }); setGroups(r.data || []); } catch {}
    setLoading(false);
  };

  const create = async e => {
    e.preventDefault();
    setCreating(true);
    try {
      const r = await axios.post(`${API}/api/groups`, form, { withCredentials: true });
      setGroups(p => [{ ...r.data, is_member: true, member_count: 1 }, ...p]);
      setForm({ title: '', description: '' }); setShowForm(false);
      toast.success('Group created!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    setCreating(false);
  };

  const filtered = groups.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto anim-fade">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Groups</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Discover and join communities</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Create Group
        </button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5 anim-scale dark:bg-gray-800 dark:border-gray-700">
          <h2 className="font-bold text-base mb-4 dark:text-gray-100">New Group</h2>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="label dark:text-gray-300">Group Name *</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Give your group a name" required />
            </div>
            <div>
              <label className="label dark:text-gray-300">Description *</label>
              <textarea className="input resize-none" rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this group about?" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="btn btn-primary btn-sm">{creating ? 'Creating…' : 'Create'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="relative mb-5">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups…" className="input pl-10" />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="card p-5 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex gap-3 items-start">
                <div className="w-14 h-14 rounded-2xl skeleton shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 skeleton w-3/4" />
                  <div className="h-3 skeleton" />
                  <div className="h-3 skeleton w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center dark:bg-gray-800 dark:border-gray-700">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <p className="font-semibold text-gray-600 dark:text-gray-300">{search ? 'No groups found' : 'No groups yet'}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{search ? 'Try a different term' : 'Be the first to create one!'}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(g => (
            <Link key={g.id} href={`/groups/${g.id}`}
              className="card p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 block group dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700">
              <div className="flex gap-4 items-start">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-extrabold shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
                  {g.title[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{g.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-snug">{g.description}</p>
                  <div className="flex items-center gap-3 mt-2.5">
                    <span className="text-xs text-gray-400 dark:text-gray-500">👤 {g.member_count} members</span>
                    {g.is_member && <span className="badge badge-green text-[11px]">✓ Joined</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}