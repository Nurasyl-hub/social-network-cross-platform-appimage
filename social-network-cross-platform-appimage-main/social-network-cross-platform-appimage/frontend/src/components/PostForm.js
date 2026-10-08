import { useState, useRef } from 'react';
import axios from 'axios';
import { useAuth, API } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function PostForm({ onPostCreated }) {
  const { user } = useAuth();
  const toast = useToast();
  const [content, setContent]   = useState('');
  const [privacy, setPrivacy]   = useState('public');
  const [image, setImage]       = useState(null);
  const [preview, setPreview]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [followers, setFollowers]   = useState([]);
  const [selected, setSelected]     = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [focused, setFocused]       = useState(false);
  const fileRef = useRef();

  const loadFollowers = async () => {
    if (followers.length) return;
    try { const r = await axios.get(`${API}/api/users/${user.id}`, { withCredentials: true }); setFollowers(r.data.followers || []); } catch {}
  };

  const handlePrivacy = async v => {
    setPrivacy(v);
    if (v === 'private') { await loadFollowers(); setShowPicker(true); }
    else { setShowPicker(false); setSelected([]); }
  };

  const submit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('content', content); fd.append('privacy', privacy);
      if (image) fd.append('image', image);
      if (privacy === 'private' && selected.length) fd.append('viewers', selected.join(','));
      const r = await axios.post(`${API}/api/posts`, fd, { withCredentials: true });
      setContent(''); setPrivacy('public'); setImage(null); setPreview(null); setSelected([]); setShowPicker(false); setFocused(false);
      onPostCreated?.({ ...r.data, author: user, comment_count: 0 });
      toast.success('Post published!');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to post'); }
    setSubmitting(false);
  };

  return (
    <div className={`card p-4 mb-4 transition-shadow duration-200 dark:bg-gray-800 dark:border-gray-700 ${focused ? 'shadow-card-hover ring-2 ring-blue-100 dark:ring-blue-400/30' : ''}`}>
      <div className="flex gap-3">
        <img src={user.avatar ? `${API}${user.avatar}` : '/default-avatar.png'} className="avatar w-10 h-10 shrink-0" alt="" />
        <div className="flex-1 min-w-0">
          <textarea value={content} onChange={e => setContent(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => !content && setFocused(false)}
            placeholder="What's on your mind?"
            rows={focused ? 3 : 2}
            className="w-full resize-none border-0 outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-400 bg-transparent leading-relaxed" />

          {preview && (
            <div className="relative mt-2">
              <img src={preview} className="w-full max-h-52 object-cover rounded-xl" alt="" />
              <button onClick={() => { setImage(null); setPreview(null); fileRef.current.value = ''; }}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 dark:bg-white/60 text-white dark:text-black rounded-full text-xs flex items-center justify-center hover:bg-black/80 dark:hover:bg-white/80 transition-all">✕</button>
            </div>
          )}

          {showPicker && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Select who can see this:</p>
              <div className="flex flex-wrap gap-2">
                {followers.map(f => (
                  <button key={f.id} onClick={() => setSelected(p => p.includes(f.id) ? p.filter(x => x !== f.id) : [...p, f.id])}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all
                      ${selected.includes(f.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'}`}>
                    <img src={f.avatar ? `${API}${f.avatar}` : '/default-avatar.png'} className="avatar w-4 h-4" alt="" />
                    {f.first_name} {f.last_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button onClick={() => fileRef.current.click()}
                className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Photo
              </button>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.gif" hidden
                onChange={e => { const f = e.target.files[0]; if (f) { setImage(f); setPreview(URL.createObjectURL(f)); } }} />
              <select value={privacy} onChange={e => handlePrivacy(e.target.value)}
                className="text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer">
                <option value="public">🌍 Public</option>
                <option value="almost_private">👥 Followers</option>
                <option value="private">🔒 Selected</option>
              </select>
            </div>
            <button onClick={submit} disabled={submitting || !content.trim()}
              className="btn btn-primary btn-sm">
              {submitting ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Posting…</> : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}