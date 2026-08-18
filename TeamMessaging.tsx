import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AtSign, BellRing, Check, ChevronDown, Hash, Megaphone, MessageCircle, MoreHorizontal,
  Paperclip, Plus, Search, Send, Smile, Sparkles, Star, Users, X, Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Employee } from '@/lib/supabase';

type Channel = {
  id:string; name:string; slug:string; channel_type:string; audience_role?:string|null; crew_id?:string|null;
  description?:string|null; created_by?:string|null; is_active?:boolean; created_at?:string;
};
type Message = {
  id:string; channel_id:string; sender_user_id?:string|null; sender_employee_id?:string|null; sender_name:string;
  body:string; message_kind:string; related_lead_id?:string|null; related_appointment_id?:string|null; created_at:string;
};
type Props = {
  employee?: Employee|null;
  employees?: Employee[];
  portalKind?: 'admin'|'manager'|'d2d'|'detailer'|'employee';
  compact?: boolean;
};

const QUICK:Record<string,{label:string;text:string;kind:string}[]> = {
  d2d:[
    {label:'Customer Won',text:'🎉 Customer won — ',kind:'sale'},
    {label:'Appointment Set',text:'📅 Appointment set — ',kind:'appointment'},
    {label:'Need Manager',text:'⚠️ Need manager help at ',kind:'help'},
    {label:'Hot Lead',text:'🔥 Hot lead needs follow-up — ',kind:'lead'},
  ],
  detailer:[
    {label:'Detail Started',text:'🚘 Detail started — ',kind:'job_started'},
    {label:'Detail Finished',text:'✅ Detail finished — ',kind:'job_complete'},
    {label:'Running Late',text:'⏱️ Running behind schedule — ',kind:'delay'},
    {label:'Need Supplies',text:'🧴 Need supplies/restock — ',kind:'supplies'},
  ],
  employee:[
    {label:'Task Done',text:'✅ Task completed — ',kind:'update'},
    {label:'Need Help',text:'⚠️ I need help with ',kind:'help'},
  ],
  manager:[
    {label:'Crew Update',text:'📣 Crew update — ',kind:'announcement'},
    {label:'Schedule Update',text:'📅 Schedule update — ',kind:'schedule'},
    {label:'Priority',text:'⚠️ Priority update — ',kind:'priority'},
  ],
  admin:[
    {label:'Announcement',text:'📣 Company announcement — ',kind:'announcement'},
    {label:'Operations',text:'⚙️ Operations update — ',kind:'operations'},
    {label:'Urgent',text:'🚨 Urgent company update — ',kind:'priority'},
  ],
};

export default function TeamMessaging({employee,employees=[],portalKind='employee',compact=false}:Props){
  const {user,profile}=useAuth();
  const [channels,setChannels]=useState<Channel[]>([]);
  const [messages,setMessages]=useState<Message[]>([]);
  const [activeId,setActiveId]=useState('');
  const [draft,setDraft]=useState('');
  const [kind,setKind]=useState('message');
  const [search,setSearch]=useState('');
  const [messageSearch,setMessageSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [showCreate,setShowCreate]=useState(false);
  const [newName,setNewName]=useState('');
  const [newMembers,setNewMembers]=useState<string[]>([]);
  const [showInfo,setShowInfo]=useState(true);
  const [favorites,setFavorites]=useState<string[]>(()=>readFavorites());
  const endRef=useRef<HTMLDivElement|null>(null);
  const composerRef=useRef<HTMLTextAreaElement|null>(null);
  const elevated=portalKind==='admin'||portalKind==='manager'||profile?.role==='admin'||profile?.portal_role==='owner';

  const loadChannels=async()=>{
    const {data,error}=await supabase.from('employee_message_channels').select('*').eq('is_active',true).order('channel_type').order('name');
    if(error){console.warn('[messages] channel load',error);setLoading(false);return}
    const list=(data??[]) as Channel[];
    setChannels(list);
    setActiveId(v=>v&&list.some(c=>c.id===v)?v:(list[0]?.id||''));
    setLoading(false);
  };
  const loadMessages=async(channelId:string)=>{
    if(!channelId){setMessages([]);return}
    const {data,error}=await supabase.from('employee_messages').select('*').eq('channel_id',channelId).is('deleted_at',null).order('created_at',{ascending:true}).limit(300);
    if(error){console.warn('[messages] message load',error);return}
    setMessages((data??[]) as Message[]);
    if(user) await supabase.from('employee_message_reads').upsert({channel_id:channelId,user_id:user.id,last_read_at:new Date().toISOString()},{onConflict:'channel_id,user_id'}).then(()=>{});
  };
  useEffect(()=>{loadChannels()},[]);
  useEffect(()=>{if(activeId)loadMessages(activeId)},[activeId]);
  useEffect(()=>{
    if(!activeId)return;
    const subscription=supabase.channel(`employee-messages-${activeId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'employee_messages',filter:`channel_id=eq.${activeId}`},payload=>{
        setMessages(p=>p.some(x=>x.id===(payload.new as any).id)?p:[...p,payload.new as Message]);
      }).subscribe();
    return()=>{supabase.removeChannel(subscription)};
  },[activeId]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[messages.length,activeId]);

  const filteredChannels=channels.filter(c=>!search||`${c.name} ${c.description||''}`.toLowerCase().includes(search.toLowerCase()));
  const favoriteChannels=filteredChannels.filter(c=>favorites.includes(c.id));
  const regularChannels=filteredChannels.filter(c=>!favorites.includes(c.id));
  const active=channels.find(c=>c.id===activeId)||null;
  const quick=QUICK[portalKind]||QUICK.employee;
  const visibleMessages=useMemo(()=>messages.filter(m=>!messageSearch||`${m.sender_name} ${m.body}`.toLowerCase().includes(messageSearch.toLowerCase())),[messages,messageSearch]);
  const recentAuthors=useMemo(()=>Array.from(new Set(messages.slice(-40).map(m=>m.sender_name))).slice(0,6),[messages]);

  const send=async(e?:FormEvent)=>{
    e?.preventDefault();if(!draft.trim()||!activeId||!user)return;setSending(true);
    const payload={channel_id:activeId,sender_user_id:user.id,sender_employee_id:employee?.id||null,sender_name:employee?.name||profile?.full_name||'North Splash Team',body:draft.trim(),message_kind:kind||'message'};
    const {error}=await supabase.from('employee_messages').insert(payload);
    setSending(false);if(error)return alert(error.message);setDraft('');setKind('message');composerRef.current?.focus();
  };
  const onComposerKeyDown=(e:KeyboardEvent<HTMLTextAreaElement>)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}};
  const quickSend=(q:{text:string;kind:string})=>{setDraft(q.text);setKind(q.kind);setTimeout(()=>composerRef.current?.focus(),0)};
  const toggleFavorite=(id:string)=>setFavorites(prev=>{const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];localStorage.setItem('ns_message_favorites',JSON.stringify(next));return next});
  const createGroup=async(e:FormEvent)=>{
    e.preventDefault();if(!user||!newName.trim())return;const slug=`custom-${Date.now().toString(36)}`;
    const {data,error}=await supabase.from('employee_message_channels').insert({name:newName.trim(),slug,channel_type:'custom',description:'Private team group',created_by:user.id,is_active:true}).select().single();
    if(error)return alert(error.message);
    const rows=[...(employee?.id?[{channel_id:data.id,user_id:user.id,employee_id:employee.id,member_role:'owner',can_post:true}]:[{channel_id:data.id,user_id:user.id,employee_id:null,member_role:'owner',can_post:true}]),...newMembers.map(id=>({channel_id:data.id,user_id:employees.find(x=>x.id===id)?.user_id||null,employee_id:id,member_role:'member',can_post:true}))];
    const {error:memberError}=await supabase.from('employee_message_channel_members').insert(rows);if(memberError)return alert(memberError.message);
    setNewName('');setNewMembers([]);setShowCreate(false);await loadChannels();setActiveId(data.id);
  };
  const mine=(m:Message)=>m.sender_user_id===user?.id;

  const channelButton=(c:Channel)=><button key={c.id} className={activeId===c.id?'message-channel active':'message-channel'} onClick={()=>setActiveId(c.id)}>
    <span className="message-channel-icon">{channelIcon(c)}</span>
    <span className="message-channel-copy"><strong>{c.name}</strong><small>{c.description||channelLabel(c)}</small></span>
    <span className="message-channel-dot"/>
  </button>;

  return <div className={`team-messaging messaging-v6 ${compact?'team-messaging-compact':''} ${showInfo?'with-info':''}`}>
    <aside className="message-channel-rail">
      <div className="message-workspace-brand"><span className="message-workspace-mark">NS</span><div><strong>North Splash</strong><small>Field Communications</small></div><ChevronDown size={15}/></div>
      <div className="message-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a channel"/><kbd>⌘K</kbd></div>
      <div className="message-rail-actions"><button onClick={()=>setActiveId(channels.find(c=>c.channel_type==='company')?.id||activeId)}><BellRing size={15}/>Updates</button><button onClick={()=>composerRef.current?.focus()}><AtSign size={15}/>Compose</button></div>
      <div className="message-channel-list">
        {favoriteChannels.length>0&&<><div className="message-section-label"><span><Star size={12}/>Favorites</span></div>{favoriteChannels.map(channelButton)}</>}
        <div className="message-section-label"><span><Hash size={12}/>Channels</span>{elevated&&<button onClick={()=>setShowCreate(true)} title="Create group"><Plus size={14}/></button>}</div>
        {regularChannels.map(channelButton)}
        {!loading&&!filteredChannels.length&&<div className="ns-empty compact">No message groups available.</div>}
      </div>
      <div className="message-rail-footer"><span className="message-presence-dot"/><div><strong>{employee?.name||profile?.full_name||'North Splash Team'}</strong><small>Available · messages live</small></div></div>
    </aside>

    <section className="message-thread">
      {active?<>
        <header className="message-thread-head">
          <div className="message-thread-title"><span className="message-thread-symbol">{channelIcon(active)}</span><div><h3>{active.name}</h3><p>{active.description||'North Splash internal team communication.'}</p></div></div>
          <div className="message-thread-tools"><button className={favorites.includes(active.id)?'active':''} onClick={()=>toggleFavorite(active.id)} title="Favorite channel"><Star size={16}/></button><div className="message-thread-search"><Search size={14}/><input value={messageSearch} onChange={e=>setMessageSearch(e.target.value)} placeholder="Search conversation"/></div><button onClick={()=>setShowInfo(v=>!v)} title="Channel details"><MoreHorizontal size={18}/></button></div>
        </header>
        <div className="message-quick-row"><span><Zap size={13}/>Field shortcuts</span>{quick.map(q=><button key={q.label} onClick={()=>quickSend(q)}><Sparkles size={13}/>{q.label}</button>)}</div>
        <div className="message-scroll">
          {visibleMessages.map((m,index)=>{
            const previous=visibleMessages[index-1];
            const grouped=previous&&previous.sender_name===m.sender_name&&(new Date(m.created_at).getTime()-new Date(previous.created_at).getTime())<8*60*1000;
            const dayChanged=!previous||new Date(previous.created_at).toDateString()!==new Date(m.created_at).toDateString();
            return <div key={m.id} className="message-entry-wrap">{dayChanged&&<div className="message-day-divider"><span>{formatDay(m.created_at)}</span></div>}<article className={`${mine(m)?'message-bubble mine':'message-bubble'} ${grouped?'grouped':''}`}>
              {!grouped?<div className="message-avatar">{initials(m.sender_name)}</div>:<div className="message-avatar-spacer"><span>{new Date(m.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div>}
              <div className="message-body"><header>{!grouped&&<><strong>{m.sender_name}</strong><span>{new Date(m.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></>}</header><p>{m.body}</p>{m.message_kind!=='message'&&<small className={`message-kind kind-${m.message_kind}`}>{m.message_kind.replaceAll('_',' ')}</small>}<div className="message-hover-actions"><button title="React"><Smile size={13}/></button><button title="Reply"><MessageCircle size={13}/></button></div></div>
            </article></div>;
          })}
          {!visibleMessages.length&&!loading&&<div className="message-thread-empty"><div className="message-empty-orbit"><MessageCircle/></div><strong>{messageSearch?'No matching messages':'Start the conversation'}</strong><span>{messageSearch?'Try a different search.':`Share the first update in ${active.name}.`}</span></div>}
          <div ref={endRef}/>
        </div>
        <form className="message-composer" onSubmit={send}>
          <div className="message-composer-box"><div className="message-composer-toolbar"><button type="button" title="Add attachment"><Plus size={16}/></button><button type="button" title="Attach file"><Paperclip size={15}/></button><span>{kind!=='message'?kind.replaceAll('_',' '):'Message'}</span></div><textarea ref={composerRef} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={onComposerKeyDown} placeholder={`Message #${active.name.toLowerCase().replaceAll(' ','-')}`} rows={2}/><div className="message-composer-bottom"><small>Enter to send · Shift+Enter for new line</small><button className="message-send-btn" disabled={sending||!draft.trim()}><Send size={16}/>{sending?'Sending':'Send'}</button></div></div>
        </form>
      </>:<div className="message-thread-empty"><MessageCircle/><strong>Select a channel</strong><span>Choose a team channel to start messaging.</span></div>}
    </section>

    {showInfo&&active&&<aside className="message-info-rail">
      <div className="message-info-head"><div><span className="eyebrow">CHANNEL</span><h4>{active.name}</h4></div><button className="message-icon-btn" onClick={()=>setShowInfo(false)}><X size={16}/></button></div>
      <div className="message-info-card"><span className="message-info-icon">{channelIcon(active)}</span><strong>{channelLabel(active)}</strong><p>{active.description||'Team workspace for field communication.'}</p></div>
      <div className="message-info-section"><header><strong>Active here</strong><span>{recentAuthors.length||1}</span></header><div className="message-people-stack">{(recentAuthors.length?recentAuthors:[employee?.name||profile?.full_name||'North Splash']).map(name=><div key={name}><span>{initials(name||'NS')}</span><div><strong>{name}</strong><small>Recently active</small></div></div>)}</div></div>
      <div className="message-info-section"><header><strong>Quick workflows</strong></header>{quick.slice(0,3).map(q=><button className="message-workflow" key={q.label} onClick={()=>quickSend(q)}><Zap size={14}/><span><strong>{q.label}</strong><small>Pre-fill field update</small></span></button>)}</div>
      <div className="message-info-note"><Sparkles size={15}/><p>Operations-first messaging keeps wins, appointments, delays and help requests in the same workspace as the team conversation.</p></div>
    </aside>}

    {showCreate&&<div className="message-modal-backdrop" onClick={()=>setShowCreate(false)}><form className="message-group-modal" onSubmit={createGroup} onClick={e=>e.stopPropagation()}><header><div><span className="eyebrow">NEW GROUP</span><h3>Create message group</h3></div><button type="button" className="message-icon-btn" onClick={()=>setShowCreate(false)}><X size={17}/></button></header><label>Group name<input required value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Raleigh D2D Crew"/></label><div className="message-member-picker"><span>Members</span>{employees.filter(e=>e.status==='active').map(e=><label key={e.id}><input type="checkbox" checked={newMembers.includes(e.id)} onChange={()=>setNewMembers(p=>p.includes(e.id)?p.filter(x=>x!==e.id):[...p,e.id])}/><span>{e.name}<small>{e.role.replaceAll('_',' ')}</small></span>{newMembers.includes(e.id)&&<Check size={14}/>}</label>)}</div><button className="btn-primary"><Users size={15}/>Create Group</button></form></div>}
  </div>;
}

function channelLabel(c:Channel){if(c.channel_type==='company')return'Company-wide';if(c.channel_type==='role')return`${(c.audience_role||'team').replaceAll('_',' ')} channel`;if(c.channel_type==='crew')return'Crew channel';return'Private group'}
function channelIcon(c:Channel){if(c.channel_type==='company')return <Megaphone size={15}/>;if(c.channel_type==='custom')return <Users size={15}/>;return <Hash size={15}/>}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'NS'}
function formatDay(value:string){const d=new Date(value);const today=new Date();const yesterday=new Date();yesterday.setDate(today.getDate()-1);if(d.toDateString()===today.toDateString())return'Today';if(d.toDateString()===yesterday.toDateString())return'Yesterday';return d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}
function readFavorites(){try{const value=JSON.parse(localStorage.getItem('ns_message_favorites')||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
