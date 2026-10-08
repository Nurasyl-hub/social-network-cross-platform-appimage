import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useAuth, API } from '../context/AuthContext';
import { useWS } from '../context/WSContext';
import { useToast } from '../context/ToastContext';
import { formatDistanceToNow } from 'date-fns';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { on } = useWS();
  const toast = useToast();
  const router = useRouter();
  const [notifs, setNotifs]       = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu,  setShowMenu]    = useState(false);
  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const notifRef = useRef(null);
  const menuRef  = useRef(null);
  const unread   = notifs.filter(n => !n.is_read).length;

  
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDark = document.documentElement.classList.contains('dark');
    setDark(isDark);
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDark(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDark(true);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifs();
    return on('notification', n => setNotifs(p => [{ ...n, is_read: false }, ...p]));
  }, [user]);

  useEffect(() => {
    const h = e => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (menuRef.current  && !menuRef.current.contains(e.target))  setShowMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchNotifs = async () => {
    try { const r = await axios.get(`${API}/api/notifications`, { withCredentials: true }); setNotifs(r.data || []); } catch {}
  };

  const handleSearch = async e => {
    const q = e.target.value; setSearch(q);
    if (q.length < 2) { setResults([]); setShowSearch(false); return; }
    try { const r = await axios.get(`${API}/api/users/search?q=${q}`, { withCredentials: true }); setResults(r.data || []); setShowSearch(true); } catch {}
  };

  const markRead = async id => {
    await axios.put(`${API}/api/notifications/${id}/read`, {}, { withCredentials: true });
    setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAll = async () => {
    await axios.put(`${API}/api/notifications/read-all`, {}, { withCredentials: true });
    setNotifs(p => p.map(n => ({ ...n, is_read: true })));
  };

  const handleAcceptFollow = async (n) => {
    try {
      await axios.post(`${API}/api/follow/${n.reference_id}/accept`, {}, { withCredentials: true });
      setNotifs(p => p.filter(not => not.id !== n.id));
      toast.success('Follow request accepted');
    } catch { toast.error('Failed'); }
  };

  const handleDeclineFollow = async (n) => {
    try {
      await axios.post(`${API}/api/follow/${n.reference_id}/decline`, {}, { withCredentials: true });
      setNotifs(p => p.filter(not => not.id !== n.id));
    } catch { toast.error('Failed'); }
  };

  if (!user) return null;
  const p = router.pathname;

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/" className="font-extrabold text-xl text-blue-600 dark:text-blue-400 shrink-0 tracking-tight mr-1">
          EduNet
        </Link>

        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={search} onChange={handleSearch}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            placeholder="Search people…"
            className="w-full bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-600 transition-all" />
          {showSearch && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 anim-scale">
              {results.map(u => (
                <Link key={u.id} href={`/profile/${u.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => { setShowSearch(false); setSearch(''); }}>
                  <img src={u.avatar ? `${API}${u.avatar}` : '/default-avatar.png'} className="avatar w-9 h-9" alt="" />
                  <div>
                    <p className="text-sm font-semibold dark:text-gray-100">{u.first_name} {u.last_name}</p>
                    {u.nickname && <p className="text-xs text-gray-400">@{u.nickname}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-1 mx-2">
          {[['/', '🏠', 'Home'], ['/groups', '👥', 'Groups'], ['/chat', '💬', 'Chat']].map(([href, icon, label]) => (
            <Link key={href} href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all
                ${(href === '/' ? p === '/' : p.startsWith(href))
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'}`}>
              {icon} {label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Toggle theme">
            {dark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
              </svg>
            )}
          </button>

          <div className="relative" ref={notifRef}>
            <button onClick={() => { setShowNotifs(!showNotifs); setShowMenu(false); }}
              className={`relative p-2 rounded-xl transition-all ${showNotifs ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1 anim-scale">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 anim-scale">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                  <span className="font-bold text-sm dark:text-gray-100">Notifications</span>
                  {unread > 0 && <button onClick={markAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">Mark all read</button>}
                </div>
                <div className="max-h-96 overflow-y-auto scrollbar-thin">
                  {notifs.length === 0
                    ? <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">🔔<br/>No notifications</div>
                    : notifs.map(n => (
                      <div key={n.id}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!n.is_read ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                        <button onClick={async () => { await markRead(n.id); setShowNotifs(false); router.push(n.type === 'follow_request' ? `/profile/${n.reference_id}` : `/groups/${n.reference_id}`); }}
                          className="flex items-start gap-3 flex-1 text-left">
                          {n.from_user
                            ? <img src={n.from_user.avatar ? `${API}${n.from_user.avatar}` : '/default-avatar.png'} className="avatar w-10 h-10 mt-0.5" alt="" />
                            : <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm shrink-0">🔔</div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{n.content}</p>
                            <p className="text-xs text-gray-400 mt-1">{n.created_at && formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                          </div>
                          {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0" />}
                        </button>
                        {n.type === 'follow_request' && (
                          <div className="flex flex-col gap-1 ml-2">
                            <button onClick={async (e) => { e.stopPropagation(); await handleAcceptFollow(n); }}
                              className="btn btn-primary btn-sm text-xs">Accept</button>
                            <button onClick={async (e) => { e.stopPropagation(); await handleDeclineFollow(n); }}
                              className="btn btn-secondary btn-sm text-xs">Decline</button>
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={menuRef}>
            <button onClick={() => { setShowMenu(!showMenu); setShowNotifs(false); }}
              className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
              <img src={user.avatar ? `${API}${user.avatar}` : '/default-avatar.png'} className="avatar w-8 h-8" alt="" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 hidden md:block">{user.first_name}</span>
              <svg className="w-4 h-4 text-gray-400 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 anim-scale">
                <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                  <p className="font-bold text-sm dark:text-gray-100">{user.first_name} {user.last_name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-400">{user.email}</p>
                </div>
                <div className="py-1">
                  <Link href={`/profile/${user.id}`} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => setShowMenu(false)}>👤 My Profile</Link>
                  <Link href="/groups" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors md:hidden" onClick={() => setShowMenu(false)}>👥 Groups</Link>
                  <Link href="/chat"   className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors md:hidden" onClick={() => setShowMenu(false)}>💬 Chat</Link>
                  <hr className="border-gray-100 dark:border-gray-700" />
                  <button onClick={logout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    🚪 Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}