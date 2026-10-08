import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth, API } from '../../context/AuthContext';
import { useWS } from '../../context/WSContext';
import { useToast } from '../../context/ToastContext';

const TABS = [['posts','Posts'],['events','Events'],['chat','Chat'],['members','Members']];
const EMOJIS = ['😊','😂','❤️','👍','🎉','🔥','💯','😭','🙏','😍','🤔','👏','😎','🥳','💪','✨','🙌','😅','🤣','🫡'];

export default function GroupDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { send, on } = useWS();
  const toast = useToast();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('posts');
  const [posts, setPosts]     = useState([]);
  const [events, setEvents]   = useState([]);
  const [messages, setMessages] = useState([]);

  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage]     = useState(null);
  const [msgContent, setMsgContent]   = useState('');
  const [showEmoji, setShowEmoji]     = useState(false);

  const [inviteQ, setInviteQ]           = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [eventForm, setEventForm]         = useState({ title:'', description:'', event_time:'' });
  const [showEventForm, setShowEventForm] = useState(false);

  const [expandedPost, setExpandedPost] = useState(null);
  const [comments, setComments]         = useState({});
  const [commentText, setCommentText]   = useState({});

  const msgEndRef  = useRef();
  const postFileRef = useRef();

  useEffect(() => { if (id) fetchGroup(); }, [id]);
  useEffect(() => {
    if (!id) return;
    if (tab === 'posts')  fetchPosts();
    if (tab === 'events') fetchEvents();
    if (tab === 'chat')   fetchMessages();
  }, [tab, id]);
  useEffect(() => {
    if (tab === 'chat') msgEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages, tab]);
  useEffect(() => {
    if (!id) return;
    return on('group_message', msg => {
      if (msg.group_id === id) setMessages(p => [...p, msg]);
    });
  }, [id, on]);

  const fetchGroup    = async () => {
    try { const r = await axios.get(`${API}/api/groups/${id}`,{withCredentials:true}); setGroup(r.data); } catch { router.push('/groups'); }
    setLoading(false);
  };
  const fetchPosts    = async () => { try { const r = await axios.get(`${API}/api/groups/${id}/posts`,{withCredentials:true}); setPosts(r.data||[]); } catch {} };
  const fetchEvents   = async () => { try { const r = await axios.get(`${API}/api/groups/${id}/events`,{withCredentials:true}); setEvents(r.data||[]); } catch {} };
  const fetchMessages = async () => { try { const r = await axios.get(`${API}/api/groups/${id}/messages`,{withCredentials:true}); setMessages(r.data||[]); } catch {} };

  const handleJoin = async () => {
    try {
      await axios.post(`${API}/api/groups/${id}/join`, {}, { withCredentials: true });
      setGroup(prev => ({ ...prev, is_member: true, member_status: 'accepted' }));
      await fetchGroup();
      if (tab === 'posts') await fetchPosts();
      toast.success('Welcome to the group!');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error joining group');
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await axios.delete(`${API}/api/groups/${id}`, { withCredentials: true });
      toast.success('Group deleted');
      router.push('/groups');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete group');
    }
  };

  const submitPost = async e => {
    e.preventDefault();
    if (!postContent.trim()) return;
    const fd = new FormData(); fd.append('content', postContent);
    if (postImage) fd.append('image', postImage);
    try {
      const r = await axios.post(`${API}/api/groups/${id}/posts`, fd, {withCredentials:true});
      setPosts(p => [{ ...r.data, author: user, comment_count: 0 }, ...p]);
      setPostContent(''); setPostImage(null); toast.success('Post created');
    } catch (e) { toast.error(e.response?.data?.error||'Error'); }
  };

  const deleteGroupPost = async postId => {
    if (!confirm('Delete this post?')) return;
    try {
      await axios.delete(`${API}/api/groups/${id}/posts/${postId}`, { withCredentials: true });
      setPosts(prev => prev.filter(post => post.id !== postId));
      toast.success('Post deleted');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete post');
    }
  };

  const reactGroupPost = async (postId, reaction) => {
    try {
      const r = await axios.post(`${API}/api/groups/${id}/posts/${postId}/react`, { reaction }, { withCredentials: true });
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, likes_count: r.data.likes_count, dislikes_count: r.data.dislikes_count, user_reaction: r.data.user_reaction } : post));
    } catch (e) {
      toast.error('Failed to update reaction');
    }
  };

  const deleteGroupComment = async (postId, commentId) => {
    try {
      await axios.delete(`${API}/api/groups/${id}/posts/${postId}/comments/${commentId}`, { withCredentials: true });
      setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, comment_count: Math.max(0, (post.comment_count || 1) - 1) } : post));
      toast.success('Comment deleted');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete comment');
    }
  };

  const loadComments = async pid => {
    if (expandedPost === pid) { setExpandedPost(null); return; }
    const r = await axios.get(`${API}/api/groups/${id}/posts/${pid}/comments`,{withCredentials:true});
    setComments(p => ({...p,[pid]:r.data||[]})); setExpandedPost(pid);
  };
  const submitComment = async pid => {
    const text = commentText[pid]; if (!text?.trim()) return;
    const fd = new FormData(); fd.append('content', text);
    const r = await axios.post(`${API}/api/groups/${id}/posts/${pid}/comments`, fd, {withCredentials:true});
    setComments(p => ({...p,[pid]:[...(p[pid]||[]),r.data]}));
    setCommentText(p => ({...p,[pid]:''}));
  };

  const sendMessage = e => {
    e.preventDefault(); if (!msgContent.trim()) return;
    send('group_message', { group_id: id, content: msgContent });
    setMsgContent(''); setShowEmoji(false);
  };

  const createEvent = async e => {
    e.preventDefault();
    try {
      const r = await axios.post(`${API}/api/groups/${id}/events`, eventForm, {withCredentials:true});
      setEvents(p => [...p, r.data]); setEventForm({title:'',description:'',event_time:''}); setShowEventForm(false);
      toast.success('Event created');
    } catch (e) { toast.error(e.response?.data?.error||'Error'); }
  };
  const respondEvent = async (eid, response) => {
    await axios.post(`${API}/api/groups/${id}/events/${eid}/respond`,{response},{withCredentials:true});
    setEvents(p => p.map(ev => ev.id===eid ? {...ev,user_response:response} : ev));
    toast.success(response==='going'?'Marked as going ✓':'Marked as not going');
  };

  const searchInvite = async q => {
    setInviteQ(q); if (q.length<2) { setInviteResults([]); return; }
    const r = await axios.get(`${API}/api/users/search?q=${q}`,{withCredentials:true}); setInviteResults(r.data||[]);
  };
  const sendInvite = async uid => {
    try {
      await axios.post(`${API}/api/groups/${id}/invite`, { user_id: uid }, { withCredentials: true });
      setInviteResults([]); setInviteQ('');
      toast.success('User invited and added to group');
      fetchGroup(); // обновить список участников
    } catch (e) { toast.error(e.response?.data?.error||'Error'); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>;
  if (!group) return null;

  const isMember = group.is_member;
  const isCreator = group.is_creator;

  return (
    <div className="max-w-4xl mx-auto anim-fade">
      <div className="card p-5 mb-5 flex gap-4 items-start dark:bg-gray-800 dark:border-gray-700">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-extrabold shrink-0 shadow-lg">
          {group.title[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{group.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{group.description}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Created by {group.creator_name} · {group.members?.length || 0} members</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {!isMember && (
            <button onClick={handleJoin} className="btn btn-primary btn-sm">Join Group</button>
          )}
          {isMember && <span className={`badge ${isCreator?'badge-blue':'badge-green'}`}>{isCreator?'👑 Creator':'✓ Member'}</span>}
          {isCreator && (
            <button onClick={handleDeleteGroup} className="btn btn-danger btn-sm">Delete Group</button>
          )}
        </div>
      </div>

      {!isMember ? (
        <div className="card p-14 text-center dark:bg-gray-800 dark:border-gray-700">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <p className="font-bold text-gray-700 dark:text-gray-200 text-lg">Join this group</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 mb-5">Become a member to see posts, events and chat</p>
          <button onClick={handleJoin} className="btn btn-primary btn-lg">Join Group</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-5">
            {TABS.map(([k,l]) => (
              <button key={k} onClick={()=>setTab(k)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all
                  ${tab===k ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-card' : 'text-gray-500 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-gray-600 bg-white/40 dark:bg-gray-700/40'}`}>
                {l}
              </button>
            ))}
          </div>

          {tab==='posts' && (
            <div className="space-y-4">
              <form onSubmit={submitPost} className="card p-4 dark:bg-gray-800 dark:border-gray-700">
                <textarea value={postContent} onChange={e=>setPostContent(e.target.value)}
                  placeholder="Share something with the group…"
                  className="w-full border-0 outline-none text-sm resize-none min-h-[80px] bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500" />
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button type="button" onClick={()=>postFileRef.current.click()}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    Photo
                  </button>
                  <input ref={postFileRef} type="file" accept=".jpg,.jpeg,.png,.gif" hidden onChange={e=>setPostImage(e.target.files[0])} />
                  <button type="submit" disabled={!postContent.trim()} className="btn btn-primary btn-sm">Post</button>
                </div>
              </form>

              {posts.length===0
                ? <div className="card p-10 text-center text-gray-400 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700"><p className="font-semibold">No posts yet</p></div>
                : posts.map(p => (
                  <div key={p.id} className="card p-5 anim-scale dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-3">
                      <img src={p.author?.avatar?`${API}${p.author.avatar}`:'/default-avatar.png'} className="avatar w-10 h-10" alt=""/>
                      <div>
                        <p className="font-bold text-sm dark:text-gray-100">{p.author?.first_name} {p.author?.last_name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatDistanceToNow(new Date(p.created_at),{addSuffix:true})}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">{p.content}</p>
                    {p.image && <img src={`${API}${p.image}`} className="w-full max-h-64 object-cover rounded-xl mb-3" alt=""/>}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <button onClick={() => reactGroupPost(p.id, 'like')}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all ${p.user_reaction === 'like' ? 'bg-blue-500 text-white' : 'hover:bg-blue-50 dark:hover:bg-blue-900/60'}`}>
                        👍 {p.likes_count || 0}
                      </button>
                      <button onClick={() => reactGroupPost(p.id, 'dislike')}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all ${p.user_reaction === 'dislike' ? 'bg-red-500 text-white' : 'hover:bg-red-50 dark:hover:bg-red-900/60'}`}>
                        👎 {p.dislikes_count || 0}
                      </button>
                      <button onClick={() => loadComments(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        {p.comment_count||0} Comments
                      </button>
                      {(p.user_id === user.id || isCreator) && (
                        <button onClick={() => deleteGroupPost(p.id)} className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all">
                          Delete Post
                        </button>
                      )}
                    </div>

                    {expandedPost===p.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3 anim-fade">
                        {(comments[p.id]||[]).map(c => (
                          <div key={c.id} className="flex gap-2.5">
                            <img src={c.author?.avatar?`${API}${c.author.avatar}`:'/default-avatar.png'} className="avatar w-8 h-8 shrink-0" alt=""/>
                            <div className="flex-1">
                              <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{c.author?.first_name} {c.author?.last_name}</p>
                                  {(c.user_id === user.id || isCreator) && (
                                    <button onClick={() => deleteGroupComment(p.id, c.id)} className="text-xs text-red-500 hover:text-red-600">Delete</button>
                                  )}
                                </div>
                                <p className="text-sm mt-0.5 dark:text-gray-300">{c.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input value={commentText[p.id]||''} onChange={e=>setCommentText(prev=>({...prev,[p.id]:e.target.value}))}
                            placeholder="Write a comment…"
                            className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            onKeyDown={e=>e.key==='Enter'&&submitComment(p.id)} />
                          <button onClick={()=>submitComment(p.id)} className="btn btn-primary btn-sm">Post</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          )}

          {tab==='events' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg dark:text-gray-100">Events</h2>
                <button onClick={()=>setShowEventForm(!showEventForm)} className="btn btn-primary btn-sm">+ New Event</button>
              </div>

              {showEventForm && (
                <form onSubmit={createEvent} className="card p-5 space-y-3 anim-scale dark:bg-gray-800 dark:border-gray-700">
                  <div><label className="label dark:text-gray-300">Title *</label><input className="input" value={eventForm.title} onChange={e=>setEventForm(f=>({...f,title:e.target.value}))} required/></div>
                  <div><label className="label dark:text-gray-300">Description</label><textarea className="input resize-none" rows={2} value={eventForm.description} onChange={e=>setEventForm(f=>({...f,description:e.target.value}))}/></div>
                  <div><label className="label dark:text-gray-300">Date & Time *</label><input type="datetime-local" className="input" value={eventForm.event_time} onChange={e=>setEventForm(f=>({...f,event_time:e.target.value}))} required/></div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-primary btn-sm">Create Event</button>
                    <button type="button" onClick={()=>setShowEventForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
                  </div>
                </form>
              )}

              {events.length===0
                ? <div className="card p-10 text-center text-gray-400 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700"><p className="font-semibold">No events yet</p></div>
                : events.map(ev => (
                  <div key={ev.id} className="card p-5 anim-scale dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-base dark:text-gray-100">{ev.title}</h3>
                        {ev.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ev.description}</p>}
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 font-semibold flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          {format(new Date(ev.event_time),'PPp')}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">By {ev.creator_name}</p>
                      </div>
                      <div className="text-right text-xs font-semibold">
                        <p className="text-green-600 dark:text-green-400">✓ {ev.going_count} going</p>
                        <p className="text-red-500 dark:text-red-400 mt-1">✕ {ev.not_going_count} not going</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {['going','not_going'].map(r => (
                        <button key={r} onClick={()=>respondEvent(ev.id,r)}
                          className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all
                            ${ev.user_response===r
                              ? r==='going' ? 'bg-green-500 border-green-500 text-white shadow-sm' : 'bg-red-500 border-red-500 text-white shadow-sm'
                              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-400 bg-white dark:bg-gray-700'}`}>
                          {r==='going' ? '✓ Going' : '✕ Not Going'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {tab==='chat' && (
            <div className="card flex flex-col overflow-hidden dark:bg-gray-800 dark:border-gray-700" style={{height:'62vh'}}>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
                {messages.length===0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    <div className="text-5xl mb-3">💬</div>
                    <p className="font-semibold">No messages yet</p>
                    <p className="text-sm mt-1">Say something to the group!</p>
                  </div>
                )}
                {messages.map((m,i) => {
                  const mine = m.sender_id===user.id;
                  return (
                    <div key={m.id||i} className={`flex items-end gap-2 anim-slide ${mine?'flex-row-reverse':''}`}>
                      <img src={m.sender?.avatar?`${API}${m.sender.avatar}`:'/default-avatar.png'} className="avatar w-8 h-8 shrink-0" alt=""/>
                      <div className={`flex flex-col max-w-xs ${mine?'items-end':'items-start'}`}>
                        {!mine && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 ml-2">{m.sender_name||`${m.sender?.first_name} ${m.sender?.last_name}`}</p>}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${mine?'bg-blue-600 text-white rounded-br-sm':'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'}`}>
                          {m.content}
                        </div>
                        <p className="text-xs text-gray-300 dark:text-gray-500 mt-1 mx-1">{m.created_at&&formatDistanceToNow(new Date(m.created_at),{addSuffix:true})}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef}/>
              </div>

              <form onSubmit={sendMessage} className="border-t border-gray-100 dark:border-gray-700 p-3 flex gap-2 items-center dark:bg-gray-800">
                <div className="relative">
                  <button type="button" onClick={()=>setShowEmoji(!showEmoji)} className="text-2xl hover:scale-110 transition-transform p-1">😊</button>
                  {showEmoji && (
                    <div className="absolute bottom-12 left-0 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-xl p-2.5 grid grid-cols-5 gap-1 z-20 anim-scale" style={{width:220}}>
                      {EMOJIS.map(em => (
                        <button key={em} type="button" onClick={()=>{setMsgContent(p=>p+em);setShowEmoji(false);}}
                          className="text-xl hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg p-1.5 transition-colors hover:scale-125 transform">
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input value={msgContent} onChange={e=>setMsgContent(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-600 transition-all"/>
                <button type="submit" disabled={!msgContent.trim()} className="btn btn-primary btn-sm px-4">Send</button>
              </form>
            </div>
          )}

          {tab==='members' && (
            <div className="space-y-4">
              <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
                <h3 className="font-bold text-sm dark:text-gray-100 mb-3">Invite People</h3>
                <div className="relative">
                  <input value={inviteQ} onChange={e=>searchInvite(e.target.value)} placeholder="Search by name…" className="input"/>
                  {inviteResults.length>0 && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-xl mt-1 z-10 max-h-52 overflow-y-auto anim-scale">
                      {inviteResults.map(u => (
                        <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                          <img src={u.avatar?`${API}${u.avatar}`:'/default-avatar.png'} className="avatar w-9 h-9" alt=""/>
                          <span className="flex-1 text-sm font-medium dark:text-gray-200">{u.first_name} {u.last_name}</span>
                          <button onClick={()=>sendInvite(u.id)} className="btn btn-primary btn-sm">Invite</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
                <h3 className="font-bold text-sm mb-4 dark:text-gray-100">Members ({(group.members||[]).filter(m=>m.status==='accepted').length})</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(group.members||[]).filter(m=>m.status==='accepted').map(m => (
                    <Link key={m.id} href={`/profile/${m.id}`}
                      className="flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors border border-gray-100 dark:border-gray-600">
                      <img src={m.avatar?`${API}${m.avatar}`:'/default-avatar.png'} className="avatar w-11 h-11" alt=""/>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate dark:text-gray-200">{m.first_name} {m.last_name}</p>
                        {m.id===group.creator_id && <span className="badge badge-blue text-[10px]">👑 Creator</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}