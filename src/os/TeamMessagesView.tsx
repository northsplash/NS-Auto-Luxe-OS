import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, AtSign, BellRing, Check, ChevronDown, Hash, Megaphone, MessageCircle, MoreHorizontal,
  Paperclip, Plus, Search, Send, Smile, Sparkles, Star, Users, X, Zap,
} from 'lucide-react';
import type { OsChat } from './demoData';
import { useOs } from './osStore';

function Avatar({ initials, hue, size = 34 }: { initials: string; hue: string; size?: number }) {
  return <span className="nsos-avatar message-avatar employee-message-avatar" style={{ width: size, height: size, background: hue, fontSize: size * 0.32 }}>{initials}</span>;
}

const QUICK = [
  { label: 'Announcement', text: '📣 Company announcement — ', kind: 'announcement' },
  { label: 'Operations', text: '⚙️ Operations update — ', kind: 'operations' },
  { label: 'Urgent', text: '🚨 Urgent company update — ', kind: 'priority' },
];

function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem('ns_message_favorites') || '[]');
    return Array.isArray(value) ? value as string[] : [];
  } catch {
    return [];
  }
}

export default function TeamMessagesView() {
  const os = useOs();
  const channels = os.chats.filter((c) => c.kind === 'space');
  const [activeId, setActiveId] = useState(() => channels.find((c) => c.channel_type === 'company')?.id || channels[0]?.id || '');
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState('message');
  const [search, setSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showInfo, setShowInfo] = useState(true);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const filtered = channels.filter((c) => !search || `${c.name} ${c.description || c.topic || ''}`.toLowerCase().includes(search.toLowerCase()));
  const favoriteChannels = filtered.filter((c) => favorites.includes(c.id));
  const regularChannels = filtered.filter((c) => !favorites.includes(c.id));
  const active = channels.find((c) => c.id === activeId) || channels[0] || null;
  const visibleMessages = useMemo(
    () => (active?.messages || []).filter((m) => !messageSearch || `${m.from} ${m.body}`.toLowerCase().includes(messageSearch.toLowerCase())),
    [active, messageSearch],
  );
  const recentAuthors = useMemo(
    () => Array.from(new Set((active?.messages || []).slice(-40).map((m) => m.from))).slice(0, 6),
    [active],
  );

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || !active) return;
    os.sendChat(active.id, draft.trim());
    setDraft('');
    setKind('message');
    composerRef.current?.focus();
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 40);
  };
  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };
  const quickSend = (q: { text: string; kind: string }) => {
    setDraft(q.text);
    setKind(q.kind);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };
  const toggleFavorite = (id: string) => setFavorites((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    localStorage.setItem('ns_message_favorites', JSON.stringify(next));
    return next;
  });
  const createGroup = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const id = os.createChat(newName.trim(), 'space');
    setNewName('');
    setNewMembers([]);
    setShowCreate(false);
    setActiveId(id);
    setMobileThreadOpen(true);
  };

  const channelButton = (c: OsChat) => (
    <button
      key={c.id}
      className={active?.id === c.id ? 'message-channel active' : 'message-channel'}
      onClick={() => { setActiveId(c.id); setMobileThreadOpen(true); os.markChatRead(c.id); }}
    >
      <span className="message-channel-icon">{channelIcon(c)}</span>
      <span className="message-channel-copy">
        <span className="message-channel-title-v27">
          <strong>{c.name}</strong>
          {c.at && <time>{c.at}</time>}
        </span>
        <small>{c.preview || c.description || channelLabel(c)}</small>
      </span>
      {c.unread > 0 ? <b className="message-unread-v27">{c.unread > 99 ? '99+' : c.unread}</b> : <span className="message-channel-dot" />}
    </button>
  );

  return (
    <div className={`team-messaging messaging-v6 ${showInfo ? 'with-info' : ''} ${mobileThreadOpen ? 'thread-open' : ''}`}>
      <aside className="message-channel-rail">
        <div className="message-workspace-brand">
          <span className="message-workspace-mark">NS</span>
          <div><strong>North Splash</strong><small>Field Communications</small></div>
          <ChevronDown size={15} />
        </div>
        <div className="message-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a channel" />
          <kbd>⌘K</kbd>
        </div>
        <div className="message-rail-actions">
          <button onClick={() => setActiveId(channels.find((c) => c.channel_type === 'company')?.id || activeId)}>
            <BellRing size={15} />Updates
          </button>
          <button onClick={() => composerRef.current?.focus()}><AtSign size={15} />Compose</button>
        </div>
        <div className="message-channel-list">
          {favoriteChannels.length > 0 && (
            <>
              <div className="message-section-label"><span><Star size={12} />Favorites</span></div>
              {favoriteChannels.map(channelButton)}
            </>
          )}
          <div className="message-section-label">
            <span><Hash size={12} />Channels</span>
            <button onClick={() => setShowCreate(true)} title="Create group"><Plus size={14} /></button>
          </div>
          {regularChannels.map(channelButton)}
          {!filtered.length && <div className="ns-empty compact">No message groups available.</div>}
        </div>
        <div className="message-rail-footer">
          <span className="message-presence-dot" />
          <div><strong>North Splash Admin</strong><small>Available · messages live</small></div>
        </div>
      </aside>

      <section className="message-thread">
        {active ? (
          <>
            <header className="message-thread-head">
              <button className="message-mobile-back" type="button" onClick={() => setMobileThreadOpen(false)} aria-label="Back to channels">
                <ArrowLeft size={18} />
              </button>
              <div className="message-thread-title">
                <span className="message-thread-symbol">{channelIcon(active)}</span>
                <div>
                  <h3>{active.name}</h3>
                  <p>{active.description || 'North Splash internal team communication.'}</p>
                </div>
              </div>
              <div className="message-thread-tools">
                <button className={favorites.includes(active.id) ? 'active' : ''} onClick={() => toggleFavorite(active.id)} title="Favorite channel">
                  <Star size={16} />
                </button>
                <div className="message-thread-search">
                  <Search size={14} />
                  <input value={messageSearch} onChange={(e) => setMessageSearch(e.target.value)} placeholder="Search conversation" />
                </div>
                <button onClick={() => setShowInfo((v) => !v)} title="Channel details"><MoreHorizontal size={18} /></button>
              </div>
            </header>
            <div className="message-quick-row">
              <span><Zap size={13} />Field shortcuts</span>
              {QUICK.map((q) => (
                <button key={q.label} onClick={() => quickSend(q)}><Sparkles size={13} />{q.label}</button>
              ))}
            </div>
            <div className="message-scroll">
              {visibleMessages.map((m, index) => {
                const previous = visibleMessages[index - 1];
                const grouped = previous && previous.from === m.from;
                const employee = os.employees.find((e) => e.name === m.from);
                return (
                  <div key={m.id} className="message-entry-wrap">
                    <article className={`${m.mine ? 'message-bubble mine' : 'message-bubble'} ${grouped ? 'grouped' : ''}`}>
                      {!grouped ? (
                        <Avatar initials={employee?.initials || initials(m.from)} hue={employee?.hue || '#c8a96a'} size={34} />
                      ) : (
                        <div className="message-avatar-spacer"><span>{m.at}</span></div>
                      )}
                      <div className="message-body">
                        <header>{!grouped && <><strong>{m.from}</strong><span>{m.at}</span></>}</header>
                        <p>{m.body}</p>
                        <div className="message-hover-actions">
                          <button type="button" title="React" onClick={() => { setDraft((p) => `${p}${p ? ' ' : ''}👍`); composerRef.current?.focus(); }}><Smile size={13} /></button>
                          <button type="button" title="Reply" onClick={() => { setDraft(`@${m.from} `); composerRef.current?.focus(); }}><MessageCircle size={13} /></button>
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
              {!visibleMessages.length && (
                <div className="message-thread-empty">
                  <div className="message-empty-orbit"><MessageCircle /></div>
                  <strong>{messageSearch ? 'No matching messages' : 'Start the conversation'}</strong>
                  <span>{messageSearch ? 'Try a different search.' : `Share the first update in ${active.name}.`}</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <form className="message-composer" onSubmit={send}>
              <div className="message-composer-box">
                <div className="message-composer-toolbar">
                  <button type="button" title="Add attachment"><Plus size={16} /></button>
                  <button type="button" title="Attach file"><Paperclip size={15} /></button>
                  <span>{kind !== 'message' ? kind.replaceAll('_', ' ') : 'Message'}</span>
                </div>
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder={`Message #${active.name.toLowerCase().replaceAll(' ', '-')}`}
                  rows={2}
                />
                <div className="message-composer-bottom">
                  <small>Enter to send · Shift+Enter for new line</small>
                  <button className="message-send-btn" disabled={!draft.trim()}><Send size={16} />Send</button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="message-thread-empty">
            <MessageCircle />
            <strong>Select a channel</strong>
            <span>Choose a team channel to start messaging.</span>
          </div>
        )}
      </section>

      {showInfo && active && (
        <aside className="message-info-rail">
          <div className="message-info-head">
            <div><span className="eyebrow">CHANNEL</span><h4>{active.name}</h4></div>
            <button className="message-icon-btn" onClick={() => setShowInfo(false)}><X size={16} /></button>
          </div>
          <div className="message-info-card">
            <span className="message-info-icon">{channelIcon(active)}</span>
            <strong>{channelLabel(active)}</strong>
            <p>{active.description || 'Team workspace for field communication.'}</p>
          </div>
          <div className="message-info-section">
            <header><strong>Active here</strong><span>{recentAuthors.length || 1}</span></header>
            <div className="message-people-stack">
              {(recentAuthors.length ? recentAuthors : ['North Splash Admin']).map((name) => {
                const emp = os.employees.find((e) => e.name.toLowerCase() === name.toLowerCase());
                return (
                  <div key={name}>
                    <Avatar initials={emp?.initials || initials(name)} hue={emp?.hue || '#c8a96a'} size={32} />
                    <div><strong>{name}</strong><small>Recently active</small></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="message-info-section">
            <header><strong>Quick workflows</strong></header>
            {QUICK.map((q) => (
              <button className="message-workflow" key={q.label} onClick={() => quickSend(q)}>
                <Zap size={14} />
                <span><strong>{q.label}</strong><small>Pre-fill field update</small></span>
              </button>
            ))}
          </div>
          <div className="message-info-note">
            <Sparkles size={15} />
            <p>Operations-first messaging keeps wins, appointments, delays and help requests in the same workspace as the team conversation.</p>
          </div>
        </aside>
      )}

      {showCreate && (
        <div className="message-modal-backdrop" onClick={() => setShowCreate(false)}>
          <form className="message-group-modal" onSubmit={createGroup} onClick={(e) => e.stopPropagation()}>
            <header>
              <div><span className="eyebrow">NEW GROUP</span><h3>Create message group</h3></div>
              <button type="button" className="message-icon-btn" onClick={() => setShowCreate(false)}><X size={17} /></button>
            </header>
            <label>Group name<input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Raleigh D2D Crew" /></label>
            <div className="message-member-picker">
              <span>Members</span>
              {os.employees.filter((e) => e.status === 'active').map((e) => (
                <label key={e.id}>
                  <input type="checkbox" checked={newMembers.includes(e.id)} onChange={() => setNewMembers((p) => p.includes(e.id) ? p.filter((x) => x !== e.id) : [...p, e.id])} />
                  <span>{e.name}<small>{e.role.replaceAll('_', ' ')}</small></span>
                  {newMembers.includes(e.id) && <Check size={14} />}
                </label>
              ))}
            </div>
            <button className="btn-primary"><Users size={15} />Create Group</button>
          </form>
        </div>
      )}
    </div>
  );
}

function channelLabel(c: OsChat) {
  if (c.channel_type === 'company') return 'Company-wide';
  if (c.channel_type === 'role') return 'Role channel';
  if (c.channel_type === 'crew') return 'Crew channel';
  if (c.kind === 'dm') return 'Direct message';
  return 'Private group';
}
function channelIcon(c: OsChat) {
  if (c.channel_type === 'company') return <Megaphone size={15} />;
  if (c.channel_type === 'custom') return <Users size={15} />;
  return <Hash size={15} />;
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || 'NS';
}
