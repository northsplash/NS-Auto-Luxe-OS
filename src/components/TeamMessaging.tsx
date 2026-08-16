import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Check, ChevronLeft, Megaphone, MessageCircle, Plus, Search, Send, Sparkles, Users, X } from 'lucide-react';
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
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [showCreate,setShowCreate]=useState(false);
  const [newName,setNewName]=useState('');
  const [newMembers,setNewMembers]=useState<string[]>([]);
  const endRef=useRef<HTMLDivElement|null>(null);
  const elevated=portalKind==='admin'||portalKind==='manager'||profile?.role==='admin'||profile?.portal_role==='owner';

  const loadChannels=async()=>{
    const {data,error}=await supabase.from('employee_message_channels').select('*').eq('is_active',true).order('channel_type').order('name');
    if(error){console.warn('[messages] channel load',error);setLoading(false);return}
    const list=(data??[]) as Channel[];setChannels(list);setActiveId(v=>v&&list.some(c=>c.id===v)?v:(list[0]?.id||''));setLoading(false);
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
  const active=channels.find(c=>c.id===activeId)||null;
  const quick=QUICK[portalKind]||QUICK.employee;
  const send=async(e?:FormEvent)=>{
    e?.preventDefault();if(!draft.trim()||!activeId||!user)return;setSending(true);
    const payload={channel_id:activeId,sender_user_id:user.id,sender_employee_id:employee?.id||null,sender_name:employee?.name||profile?.full_name||'North Splash Team',body:draft.trim(),message_kind:kind||'message'};
    const {error}=await supabase.from('employee_messages').insert(payload);setSending(false);if(error)return alert(error.message);setDraft('');setKind('message');
  };
  const quickSend=(q:{text:string;kind:string})=>{setDraft(q.text);setKind(q.kind)};
  const createGroup=async(e:FormEvent)=>{
    e.preventDefault();if(!user||!newName.trim())return;const slug=`custom-${Date.now().toString(36)}`;
    const {data,error}=await supabase.from('employee_message_channels').insert({name:newName.trim(),slug,channel_type:'custom',description:'Private team group',created_by:user.id,is_active:true}).select().single();
    if(error)return alert(error.message);
    const rows=[...(employee?.id?[{channel_id:data.id,user_id:user.id,employee_id:employee.id,member_role:'owner',can_post:true}]:[{channel_id:data.id,user_id:user.id,employee_id:null,member_role:'owner',can_post:true}]),...newMembers.map(id=>({channel_id:data.id,user_id:employees.find(x=>x.id===id)?.user_id||null,employee_id:id,member_role:'member',can_post:true}))];
    const {error:memberError}=await supabase.from('employee_message_channel_members').insert(rows);if(memberError)return alert(memberError.message);
    setNewName('');setNewMembers([]);setShowCreate(false);await loadChannels();setActiveId(data.id);
  };
  const mine=(m:Message)=>m.sender_user_id===user?.id;

  return <div className={`team-messaging ${compact?'team-messaging-compact':''}`}>
    <aside className="message-channel-rail">
      <div className="message-rail-head"><div><span className="eyebrow">TEAM COMMS</span><h3>Messages</h3></div>{elevated&&<button className="message-icon-btn" onClick={()=>setShowCreate(true)} title="Create group"><Plus size={17}/></button>}</div>
      <div className="message-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search groups"/></div>
      <div className="message-channel-list">{filteredChannels.map(c=><button key={c.id} className={activeId===c.id?'message-channel active':'message-channel'} onClick={()=>setActiveId(c.id)}><span className="message-channel-icon">{c.channel_type==='company'?<Megaphone size={15}/>:<Users size={15}/>}</span><span><strong>{c.name}</strong><small>{c.description||channelLabel(c)}</small></span></button>)}{!loading&&!filteredChannels.length&&<div className="ns-empty compact">No message groups available.</div>}</div>
    </aside>
    <section className="message-thread">
      {active?<><header className="message-thread-head"><div><span className="eyebrow">{channelLabel(active)}</span><h3>{active.name}</h3><p>{active.description||'North Splash internal team communication.'}</p></div><div className="message-live-pill"><i/>Live</div></header>
      <div className="message-quick-row">{quick.map(q=><button key={q.label} onClick={()=>quickSend(q)}><Sparkles size={13}/>{q.label}</button>)}</div>
      <div className="message-scroll">{messages.map(m=><article key={m.id} className={mine(m)?'message-bubble mine':'message-bubble'}><div className="message-avatar">{initials(m.sender_name)}</div><div><header><strong>{m.sender_name}</strong><span>{new Date(m.created_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span></header><p>{m.body}</p>{m.message_kind!=='message'&&<small className="message-kind">{m.message_kind.replaceAll('_',' ')}</small>}</div></article>)}{!messages.length&&!loading&&<div className="message-thread-empty"><MessageCircle/><strong>No messages yet</strong><span>Start the conversation for this group.</span></div>}<div ref={endRef}/></div>
      <form className="message-composer" onSubmit={send}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Message your team…" rows={2}/><button className="btn-primary" disabled={sending||!draft.trim()}><Send size={15}/>{sending?'Sending':'Send'}</button></form></>:<div className="message-thread-empty"><MessageCircle/><strong>Select a group</strong><span>Choose a team channel to start messaging.</span></div>}
    </section>
    {showCreate&&<div className="message-modal-backdrop" onClick={()=>setShowCreate(false)}><form className="message-group-modal" onSubmit={createGroup} onClick={e=>e.stopPropagation()}><header><div><span className="eyebrow">NEW GROUP</span><h3>Create message group</h3></div><button type="button" className="message-icon-btn" onClick={()=>setShowCreate(false)}><X size={17}/></button></header><label>Group name<input required value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Raleigh D2D Crew"/></label><div className="message-member-picker"><span>Members</span>{employees.filter(e=>e.status==='active').map(e=><label key={e.id}><input type="checkbox" checked={newMembers.includes(e.id)} onChange={()=>setNewMembers(p=>p.includes(e.id)?p.filter(x=>x!==e.id):[...p,e.id])}/><span>{e.name}<small>{e.role.replaceAll('_',' ')}</small></span>{newMembers.includes(e.id)&&<Check size={14}/>}</label>)}</div><button className="btn-primary"><Users size={15}/>Create Group</button></form></div>}
  </div>;
}

function channelLabel(c:Channel){if(c.channel_type==='company')return'Company-wide';if(c.channel_type==='role')return`${(c.audience_role||'team').replaceAll('_',' ')} channel`;if(c.channel_type==='crew')return'Crew channel';return'Private group'}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'NS'}
