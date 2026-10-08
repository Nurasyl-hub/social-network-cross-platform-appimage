import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import PostCard from '../components/PostCard';
import PostForm from '../components/PostForm';
import { API, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Home() {
  const { user } = useAuth();
  const toast = useToast();
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [requests, setRequests] = useState([]);

  useEffect(() => { fetchFeed(); fetchRequests(); }, []);

  const fetchFeed = async () => {
    try { const r = await axios.get(`${API}/api/posts`, { withCredentials: true }); setPosts(r.data || []); } catch {}
    setLoading(false);
  };
  const fetchRequests = async () => {
    try { const r = await axios.get(`${API}/api/follow-requests`, { withCredentials: true }); setRequests(r.data || []); } catch {}
  };
  const accept = async id => {
    await axios.post(`${API}/api/follow/${id}/accept`, {}, { withCredentials: true });
    setRequests(p => p.filter(r => r.id !== id)); toast.success('Follow request accepted');
  };
  const decline = async id => {
    await axios.post(`${API}/api/follow/${id}/decline`, {}, { withCredentials: true });
    setRequests(p => p.filter(r => r.id !== id));
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <PostForm onPostCreated={p => setPosts(prev => [p, ...prev])} />

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card p-5 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-full skeleton" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 skeleton w-32" />
                    <div className="h-3 skeleton w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 skeleton" />
                  <div className="h-3 skeleton w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="card p-12 text-center dark:bg-gray-800 dark:border-gray-700">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
            </div>
            <p className="font-semibold text-gray-600 dark:text-gray-300">No posts yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Follow people or create your first post!</p>
          </div>
        ) : (
          <div>{posts.map(p => (
            <PostCard key={p.id} post={p} onDelete={id => setPosts(prev => prev.filter(x => x.id !== id))} />
          ))}</div>
        )}
      </div>

      <div className="w-72 shrink-0 hidden lg:block space-y-4">
        <div className="card overflow-hidden p-0 dark:bg-gray-800 dark:border-gray-700">
          <div className="h-16 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="px-4 pb-4 -mt-7">
            <Link href={`/profile/${user.id}`}>
              <img src={user.avatar ? `${API}${user.avatar}` : '/default-avatar.png'}
                className="avatar w-14 h-14 border-3 border-white dark:border-gray-800 shadow-md mb-2" style={{border:'3px solid white'}} alt="" />
            </Link>
            <p className="font-bold text-gray-900 dark:text-gray-100">{user.first_name} {user.last_name}</p>
            {user.nickname && <p className="text-xs text-gray-400 dark:text-gray-400">@{user.nickname}</p>}
            <Link href={`/profile/${user.id}`}
              className="btn btn-secondary btn-sm mt-3 w-full justify-center" style={{display:'flex'}}>
              View Profile
            </Link>
          </div>
        </div>

        {requests.length > 0 && (
          <div className="card p-4 anim-scale dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 dark:text-gray-100">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">{requests.length}</span>
              Follow Requests
            </h3>
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="flex items-center gap-2">
                  <Link href={`/profile/${r.id}`}>
                    <img src={r.avatar ? `${API}${r.avatar}` : '/default-avatar.png'} className="avatar w-9 h-9" alt="" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate dark:text-gray-200">{r.first_name} {r.last_name}</p>
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => accept(r.id)} className="btn btn-primary btn-sm" style={{padding:'3px 10px',fontSize:11}}>Accept</button>
                      <button onClick={() => decline(r.id)} className="btn btn-secondary btn-sm" style={{padding:'3px 10px',fontSize:11}}>Decline</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-4 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Quick Links</h3>
          <div className="space-y-1">
            {[{href:'/groups',icon:'👥',label:'Groups'},{href:'/chat',icon:'💬',label:'Messages'},{href:`/profile/${user.id}`,icon:'👤',label:'My Profile'}].map(l => (
              <Link key={l.href} href={l.href}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <span>{l.icon}</span> {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}