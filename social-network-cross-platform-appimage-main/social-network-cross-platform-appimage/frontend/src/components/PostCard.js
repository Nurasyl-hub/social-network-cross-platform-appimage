import { useState, useRef } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { useAuth, API } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PRIVACY = { public: '🌍', almost_private: '👥', private: '🔒' };

export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();
  const toast = useToast();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments]         = useState([]);
  const [commentText, setCommentText]   = useState('');
  const [commentImg, setCommentImg]     = useState(null);
  const [loading, setLoading]           = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [count, setCount]               = useState(post.comment_count ?? 0);
  const [likes, setLikes]               = useState(post.likes_count ?? 0);
  const [dislikes, setDislikes]         = useState(post.dislikes_count ?? 0);
  const [reaction, setReaction]         = useState(post.user_reaction || '');
  const fileRef = useRef();
  const author  = post.author || {};

  const toggleComments = async () => {
    if (showComments) { setShowComments(false); return; }
    setLoading(true);
    try { const r = await axios.get(`${API}/api/posts/${post.id}/comments`, { withCredentials: true }); setComments(r.data || []); } catch {}
    setLoading(false); setShowComments(true);
  };

  const submitComment = async e => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const fd = new FormData(); fd.append('content', commentText);
      if (commentImg) fd.append('image', commentImg);
      const r = await axios.post(`${API}/api/posts/${post.id}/comments`, fd, { withCredentials: true });
      setComments(p => [...p, r.data]); setCount(c => c + 1); setCommentText(''); setCommentImg(null);
    } catch { toast.error('Failed to comment'); }
    setSubmitting(false);
  };

  const del = async () => {
    if (!confirm('Delete this post?')) return;
    try { await axios.delete(`${API}/api/posts/${post.id}`, { withCredentials: true }); onDelete?.(post.id); toast.success('Post deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  const reactPost = async reactType => {
    try {
      const r = await axios.post(`${API}/api/posts/${post.id}/react`, { reaction: reactType }, { withCredentials: true });
      setLikes(r.data.likes_count);
      setDislikes(r.data.dislikes_count);
      setReaction(r.data.user_reaction);
    } catch {
      toast.error('Failed to update reaction');
    }
  };

  const deleteComment = async commentId => {
    try {
      await axios.delete(`${API}/api/posts/${post.id}/comments/${commentId}`, { withCredentials: true });
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCount(c => Math.max(0, c - 1));
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  return (
    <div className="card p-5 mb-3 anim-fade dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-start justify-between mb-3">
        <Link href={`/profile/${post.user_id}`} className="flex items-center gap-3 group">
          <img src={author.avatar ? `${API}${author.avatar}` : '/default-avatar.png'} className="avatar w-11 h-11 ring-2 ring-transparent group-hover:ring-blue-200 dark:group-hover:ring-blue-500 transition-all" alt="" />
          <div>
            <p className="font-bold text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors dark:text-gray-100">{author.first_name} {author.last_name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {post.created_at && formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              {' · '}{PRIVACY[post.privacy] || '🌍'}
            </p>
          </div>
        </Link>
        {user?.id === post.user_id && (
          <button onClick={del} title="Delete post"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-500 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete
          </button>
        )}
      </div>

      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
      {post.image && <img src={`${API}${post.image}`} className="w-full max-h-96 object-cover rounded-xl mb-3 shadow-sm" alt="" />}

      <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-700">
        <button onClick={() => reactPost('like')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${reaction === 'like' ? 'bg-blue-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
          👍 {likes}
        </button>
        <button onClick={() => reactPost('dislike')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${reaction === 'dislike' ? 'bg-red-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
          👎 {dislikes}
        </button>
        <button onClick={toggleComments}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          {loading ? '…' : `${count} Comments`}
        </button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 anim-fade">
          {comments.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">No comments yet. Be the first!</p>
          )}
          <div className="space-y-3 mb-4">
            {comments.map(c => <CommentItem key={c.id} c={c} onDelete={deleteComment} />)}
          </div>
          <form onSubmit={submitComment} className="flex items-center gap-2">
            <img src={user.avatar ? `${API}${user.avatar}` : '/default-avatar.png'} className="avatar w-8 h-8 shrink-0" alt="" />
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-600 transition-all" />
            <button type="button" onClick={() => fileRef.current.click()} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </button>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.gif" hidden onChange={e => { const f = e.target.files[0]; if (f) setCommentImg(f); }} />
            <button type="submit" disabled={submitting || !commentText.trim()} className="btn btn-primary btn-sm">Post</button>
          </form>
        </div>
      )}
    </div>
  );
}

function CommentItem({ c, onDelete }) {
  const { user } = useAuth();
  const a = c.author || {};
  return (
    <div className="flex gap-2.5 anim-slide">
      <Link href={`/profile/${c.user_id}`}>
        <img src={a.avatar ? `${API}${a.avatar}` : '/default-avatar.png'} className="avatar w-8 h-8" alt="" />
      </Link>
      <div className="flex-1">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl px-3 py-2 inline-block max-w-sm">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/profile/${c.user_id}`} className="block text-xs font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-0.5">{a.first_name} {a.last_name}</Link>
            {c.user_id === user?.id && (
              <button onClick={() => onDelete?.(c.id)} className="text-[11px] font-semibold text-red-500 hover:text-red-600">Delete</button>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{c.content}</p>
        </div>
        {c.image && <img src={`${API}${c.image}`} className="max-h-28 rounded-xl mt-1.5 object-cover" alt="" />}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-1">{c.created_at && formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
      </div>
    </div>
  );
}