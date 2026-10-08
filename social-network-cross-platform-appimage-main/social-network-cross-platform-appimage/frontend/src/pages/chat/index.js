import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { useAuth, API } from '../../context/AuthContext';
import { useWS } from '../../context/WSContext';

const EMOJIS = ['😊','😂','❤️','👍','🎉','🔥','💯','😭','🙏','😍','🤔','👏','😎','🥳','💪','✨','🙌','🫡','😅','🤣'];

export default function Chat() {
  const router = useRouter();
  const { user: me } = useAuth();
  const { send, on } = useWS();
  const [conversations, setConversations] = useState([]);
  const [chatableUsers, setChatableUsers] = useState([]);
  const [activeUser, setActiveUser]       = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState('');
  const [showEmoji, setShowEmoji]         = useState(false);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [search, setSearch]               = useState('');
  const msgEndRef = useRef();
  const inputRef  = useRef();

  useEffect(() => { fetchConversations(); fetchChatableUsers(); }, []);
  useEffect(() => {
    if (router.query.user && chatableUsers.length > 0) openConversation(router.query.user);
  }, [router.query.user, chatableUsers]);

  useEffect(() => {
    return on('private_message', msg => {
      if (activeUser && (msg.sender_id===activeUser.id || msg.recipient_id===activeUser.id)) {
        setMessages(p => p.some(m=>m.id===msg.id) ? p : [...p, msg]);
      }
      fetchConversations();
    });
  }, [activeUser, on]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const fetchConversations = async () => {
    try { const r = await axios.get(`${API}/api/messages`,{withCredentials:true}); setConversations(r.data||[]); } catch {}
  };
  const fetchChatableUsers = async () => {
    try { const r = await axios.get(`${API}/api/messages/chatable`,{withCredentials:true}); setChatableUsers(r.data||[]); } catch {}
  };

  const openConversation = async uid => {
    const found = chatableUsers.find(u=>u.id===uid) || conversations.find(c=>c.user.id===uid)?.user;
    let obj = found;
    if (!obj?.first_name) {
      try { const r = await axios.get(`${API}/api/users/${uid}`,{withCredentials:true}); obj = r.data.user; } catch {}
    }
    setActiveUser(obj||{id:uid});
    setLoadingMsgs(true);
    try { const r = await axios.get(`${API}/api/messages/${uid}`,{withCredentials:true}); setMessages(r.data||[]); } catch {}
    setLoadingMsgs(false);
    setTimeout(()=>inputRef.current?.focus(),100);
  };

  const sendMsg = e => {
    e.preventDefault(); if (!input.trim()||!activeUser) return;
    send('private_message',{recipient_id:activeUser.id,content:input});
    setInput(''); setShowEmoji(false);
  };

  const convIds = new Set(conversations.map(c=>c.user.id));
  const newChats = chatableUsers.filter(u=>!convIds.has(u.id));
  const filtConvs = conversations.filter(c=>`${c.user.first_name} ${c.user.last_name}`.toLowerCase().includes(search.toLowerCase()));
  const filtNew   = newChats.filter(u=>`${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex overflow-hidden rounded-2xl shadow-card border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
      style={{height:'calc(100vh - 80px)',marginTop:'-24px',marginLeft:'-16px',marginRight:'-16px'}}>

      <div className={`w-80 border-r border-gray-100 dark:border-gray-700 flex flex-col shrink-0 dark:bg-gray-800 ${activeUser?'hidden md:flex':'flex'}`}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h1 className="font-extrabold text-xl text-gray-900 dark:text-gray-100 mb-3">Messages</h1>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
              className="w-full bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-600"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filtConvs.length>0 && (
            <>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-4 pt-3 pb-1">Recent</p>
              {filtConvs.map(c => (
                <ConvItem key={c.user.id} user={c.user} lastMsg={c.last_message} active={activeUser?.id===c.user.id} myId={me.id} onClick={()=>openConversation(c.user.id)}/>
              ))}
            </>
          )}
          {filtNew.length>0 && (
            <>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-4 pt-3 pb-1">Start a chat</p>
              {filtNew.map(u => (
                <ConvItem key={u.id} user={u} active={activeUser?.id===u.id} onClick={()=>openConversation(u.id)}/>
              ))}
            </>
          )}
          {filtConvs.length===0 && filtNew.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-gray-400 dark:text-gray-500">
              <div className="text-5xl mb-3">👋</div>
              <p className="font-semibold">No conversations</p>
              <p className="text-sm mt-1">Follow people to start chatting</p>
            </div>
          )}
        </div>
      </div>

      {activeUser ? (
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-gray-800 overflow-hidden">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
            <button onClick={()=>setActiveUser(null)}
              className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <img src={activeUser.avatar?`${API}${activeUser.avatar}`:'/default-avatar.png'} className="avatar w-10 h-10 ring-2 ring-blue-100" alt=""/>
            <div>
              <p className="font-bold text-sm dark:text-gray-100">{activeUser.first_name} {activeUser.last_name}</p>
              {activeUser.nickname && <p className="text-xs text-gray-400 dark:text-gray-500">@{activeUser.nickname}</p>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-3 dark:bg-gray-800">
            {loadingMsgs ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
            ) : messages.length===0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500">
                <div className="text-5xl mb-3">👋</div>
                <p className="font-semibold">No messages yet</p>
                <p className="text-sm mt-1">Say hello to {activeUser.first_name}!</p>
              </div>
            ) : messages.map((m,i) => {
              const mine = m.sender_id===me.id;
              const prev = messages[i-1];
              const showAv = !mine && (!prev||prev.sender_id!==m.sender_id);
              return (
                <div key={m.id||i} className={`flex items-end gap-2 anim-slide ${mine?'flex-row-reverse':''}`}>
                  <div className="w-8 shrink-0">
                    {showAv && <img src={activeUser.avatar?`${API}${activeUser.avatar}`:'/default-avatar.png'} className="avatar w-8 h-8" alt=""/>}
                  </div>
                  <div className={`flex flex-col max-w-xs lg:max-w-sm ${mine?'items-end':'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm
                      ${mine?'bg-blue-600 text-white rounded-br-sm':'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-100 dark:border-gray-600'}`}>
                      {m.content}
                    </div>
                    <p className="text-xs text-gray-300 dark:text-gray-500 mt-1 mx-1">{m.created_at&&formatDistanceToNow(new Date(m.created_at),{addSuffix:true})}</p>
                  </div>
                </div>
              );
            })}
            <div ref={msgEndRef}/>
          </div>

          <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-4 py-3">
            <form onSubmit={sendMsg} className="flex gap-2 items-center">
              <div className="relative">
                <button type="button" onClick={()=>setShowEmoji(!showEmoji)}
                  className="text-2xl hover:scale-110 transition-transform p-1 leading-none">😊</button>
                {showEmoji && (
                  <div className="absolute bottom-12 left-0 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-2xl p-2.5 grid grid-cols-5 gap-1 z-20 anim-scale" style={{width:220}}>
                    {EMOJIS.map(em => (
                      <button key={em} type="button" onClick={()=>{setInput(p=>p+em);setShowEmoji(false);inputRef.current?.focus();}}
                        className="text-xl hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg p-1.5 transition-colors hover:scale-125 transform">{em}</button>
                    ))}
                  </div>
                )}
              </div>
              <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg(e);} }}
                placeholder="Type a message… (Enter to send)"
                className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-600 transition-all"/>
              <button type="submit" disabled={!input.trim()}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all shadow-sm hover:shadow active:scale-95 shrink-0">
                <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50 dark:bg-gray-800">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-200 font-bold text-lg">Your messages</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Select a conversation to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ConvItem({ user, lastMsg, active, myId, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
        ${active ? 'bg-blue-50 dark:bg-blue-900/30 border-r-2 border-blue-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
      <img src={user.avatar?`${API}${user.avatar}`:'/default-avatar.png'} className="avatar w-12 h-12 shrink-0" alt=""/>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${active?'text-blue-700 dark:text-blue-400':'text-gray-900 dark:text-gray-100'}`}>{user.first_name} {user.last_name}</p>
        {lastMsg && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
            {lastMsg.sender_id===myId?'You: ':''}{lastMsg.content}
          </p>
        )}
      </div>
    </button>
  );
}
