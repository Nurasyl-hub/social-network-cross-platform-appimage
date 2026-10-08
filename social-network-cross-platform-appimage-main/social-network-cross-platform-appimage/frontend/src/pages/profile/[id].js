import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import PostCard from '../../components/PostCard';
import { useAuth, API } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function Profile() {
  const router = useRouter();
  const { id } = router.query;
  const { user: me, setUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('posts');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/users/${id}`, { withCredentials: true });
      setData(r.data);
      setEditForm({
        first_name: r.data.user.first_name, last_name: r.data.user.last_name,
        date_of_birth: r.data.user.date_of_birth, nickname: r.data.user.nickname, about_me: r.data.user.about_me,
      });
    } catch { toast.error('Failed to load'); router.push('/'); }
    setLoading(false);
  };

  const handleFollow = async () => {
    try {
      const r = await axios.post(`${API}/api/follow/${id}`, {}, { withCredentials: true });
      const accepted = r.data.status === 'accepted';
      setData(prev => ({
        ...prev,
        follow_status: r.data.status,
        is_following: accepted,
        follower_count: accepted ? prev.follower_count + 1 : prev.follower_count,
        can_see: accepted || prev.user.is_public,
      }));
      toast.success(accepted ? 'Now following!' : 'Follow request sent');
    } catch (e) { toast.error(e.response?.data?.error || 'Error'); }
  };

  const handleUnfollow = async () => {
    try {
      await axios.post(`${API}/api/unfollow/${id}`, {}, { withCredentials: true });
      setData(prev => ({
        ...prev,
        follow_status: null,
        is_following: false,
        follower_count: Math.max(0, prev.follower_count - 1),
        can_see: prev.user.is_public,
      }));
      toast.success('Unfollowed');
    } catch { toast.error('Error'); }
  };

  const togglePrivacy = async () => {
    try {
      const r = await axios.put(`${API}/api/users/${id}/privacy`, {}, { withCredentials: true });
      setData(prev => ({ ...prev, user: { ...prev.user, is_public: r.data.is_public } }));
      if (me?.id === id) setUser(prev => ({ ...prev, is_public: r.data.is_public }));
      toast.success(r.data.is_public ? 'Profile is now public' : 'Profile is now private');
    } catch { toast.error('Error'); }
  };

  const saveProfile = async () => {
    setSaving(true);
    const fd = new FormData();
    Object.entries(editForm).forEach(([k, v]) => { if (v !== undefined) fd.append(k, v); });
    if (avatarFile) fd.append('avatar', avatarFile);
    try {
      await axios.put(`${API}/api/users/${id}`, fd, { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } });
      setEditing(false); setAvatarFile(null); setAvatarPreview(null);
      load(); toast.success('Profile updated');
    } catch (e) { toast.error(e.response?.data?.error || 'Update failed'); }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
  );
  if (!data) return null;

  const { user, is_owner, is_following, follow_status, follower_count, following_count, can_see, posts, followers, following } = data;

  const FollowButton = () => {
    if (is_following) return (
      <button onClick={handleUnfollow} className="btn btn-secondary btn-sm">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
        Following
      </button>
    );
    if (follow_status === 'pending') return (
      <button disabled className="btn btn-secondary btn-sm opacity-60">⏳ Requested</button>
    );
    return (
      <button onClick={handleFollow} className="btn btn-primary btn-sm">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
        Follow
      </button>
    );
  };

  return (
    <div className="max-w-2xl mx-auto anim-fade">
      <div className="card overflow-hidden p-0 mb-5 dark:bg-gray-800 dark:border-gray-700">
        <div className="h-40 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600" />
        <div className="px-6 pb-6">
          <div className="relative inline-block -mt-14 mb-3">
            <img src={avatarPreview || (user.avatar ? `${API}${user.avatar}` : '/default-avatar.png')}
              className="avatar w-28 h-28 border-4 border-white dark:border-gray-800 shadow-lg"
              style={{border:'4px solid white'}} alt="" />
            {editing && (
              <button onClick={() => fileRef.current.click()}
                className="absolute bottom-1 right-1 w-8 h-8 bg-blue-600 text-white rounded-full text-sm flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors">
                ✏
              </button>
            )}
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.gif" hidden
              onChange={e => { const f = e.target.files[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} />
          </div>

          {!editing ? (
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{user.first_name} {user.last_name}</h1>
                {user.nickname && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">@{user.nickname}</p>}
                {user.about_me && <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-sm leading-relaxed">{user.about_me}</p>}
                <div className="flex gap-5 mt-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400"><strong className="font-bold text-gray-900 dark:text-gray-100">{follower_count}</strong> followers</span>
                  <span className="text-gray-500 dark:text-gray-400"><strong className="font-bold text-gray-900 dark:text-gray-100">{following_count}</strong> following</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 mt-1">
                {is_owner ? (
                  <>
                    <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">✏ Edit</button>
                    <button onClick={togglePrivacy} className="btn btn-secondary btn-sm">
                      {user.is_public ? '🌍 Public' : '🔒 Private'}
                    </button>
                  </>
                ) : (
                  <>
                    <FollowButton />
                    <Link href={`/chat?user=${id}`} className="btn btn-secondary btn-sm">💬 Message</Link>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-md space-y-3 anim-scale">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label dark:text-gray-300">First Name</label>
                  <input className="input" value={editForm.first_name || ''} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label dark:text-gray-300">Last Name</label>
                  <input className="input" value={editForm.last_name || ''} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label dark:text-gray-300">Date of Birth</label>
                <input type="date" className="input" value={editForm.date_of_birth || ''} onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))} />
              </div>
              <div>
                <label className="label dark:text-gray-300">Nickname</label>
                <input className="input" value={editForm.nickname || ''} onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))} placeholder="@username" />
              </div>
              <div>
                <label className="label dark:text-gray-300">About Me</label>
                <textarea className="input resize-none" rows={3} value={editForm.about_me || ''} onChange={e => setEditForm(f => ({ ...f, about_me: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={saveProfile} disabled={saving} className="btn btn-primary btn-sm">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => { setEditing(false); setAvatarFile(null); setAvatarPreview(null); }} className="btn btn-secondary btn-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {can_see ? (
        <>
          <div className="flex gap-2 mb-5">
            {[['posts','Posts',posts?.length||0],['followers','Followers',followers?.length||0],['following','Following',following?.length||0]].map(([k,l,c]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all
                  ${tab === k ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-card' : 'text-gray-500 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-gray-600 bg-white/40 dark:bg-gray-700/40'}`}>
                {l} <span className="text-xs opacity-60">({c})</span>
              </button>
            ))}
          </div>

          {tab === 'posts' && (
            <div>
              {(posts || []).length === 0
                ? <div className="card p-10 text-center text-gray-400 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700"><p className="font-semibold">No posts yet</p></div>
                : (posts || []).map(p => (
                    <PostCard key={p.id} post={{ ...p, author: user }}
                      onDelete={pid => setData(prev => ({ ...prev, posts: prev.posts.filter(x => x.id !== pid) }))} />
                  ))
              }
            </div>
          )}
          {tab === 'followers' && (
            <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="font-bold text-base mb-4 dark:text-gray-100">Followers ({(followers || []).length})</h3>
              {(followers || []).length === 0
                ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">No followers yet</p>
                : <UserGrid users={followers || []} />}
            </div>
          )}
          {tab === 'following' && (
            <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="font-bold text-base mb-4 dark:text-gray-100">Following ({(following || []).length})</h3>
              {(following || []).length === 0
                ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">Not following anyone yet</p>
                : <UserGrid users={following || []} />}
            </div>
          )}
        </>
      ) : (
        <div className="card p-14 text-center anim-scale dark:bg-gray-800 dark:border-gray-700">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <p className="font-bold text-gray-700 dark:text-gray-200 text-lg">This profile is private</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Follow this user to see their posts</p>
          {!is_owner && !is_following && follow_status !== 'pending' && (
            <button onClick={handleFollow} className="btn btn-primary mt-5 mx-auto">Send Follow Request</button>
          )}
        </div>
      )}
    </div>
  );
}

function UserGrid({ users }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {users.map(u => (
        <Link key={u.id} href={`/profile/${u.id}`}
          className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors border border-gray-100 dark:border-gray-600">
          <img src={u.avatar ? `${API}${u.avatar}` : '/default-avatar.png'} className="avatar w-11 h-11" alt="" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate dark:text-gray-200">{u.first_name} {u.last_name}</p>
            {u.nickname && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">@{u.nickname}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}