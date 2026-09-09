import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Send, Smile, MessageCircle, X } from 'lucide-react';

export const REACTION_SET = ['👍', '✅', '🔥', '🙏'] as const;

export type ReplyTarget = { id: string; name: string; body: string };
export type ReactionMap = Record<string, Partial<Record<string, boolean>>>;

export function formatChatDay(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return 'Today';
  if (/\byesterday\b/i.test(raw)) return 'Yesterday';
  if (/\btoday\b/i.test(raw)) return 'Today';
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /T|\d{4}-\d{2}-\d{2}/.test(raw)) {
    const today = new Date();
    const yday = new Date();
    yday.setDate(today.getDate() - 1);
    if (parsed.toDateString() === today.toDateString()) return 'Today';
    if (parsed.toDateString() === yday.toDateString()) return 'Yesterday';
    return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (/^\d{1,2}:\d{2}/.test(raw) || /\d{1,2}:\d{2}\s*(AM|PM)/i.test(raw)) return 'Today';
  return raw.split('·')[0].trim() || 'Today';
}

export function sameChatDay(a?: string | null, b?: string | null) {
  return formatChatDay(a) === formatChatDay(b);
}

export function useMessageReactions() {
  const [map, setMap] = useState<ReactionMap>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('ns_message_reactions') || '{}');
      return raw && typeof raw === 'object' ? raw as ReactionMap : {};
    } catch {
      return {};
    }
  });
  const toggle = (id: string, emoji: string) => {
    setMap((prev) => {
      const next = { ...prev, [id]: { ...(prev[id] || {}), [emoji]: !prev[id]?.[emoji] } };
      try { localStorage.setItem('ns_message_reactions', JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  };
  return { map, toggle };
}

export function MessageText({ body }: { body: string }) {
  const parts = String(body || '').split(/(@[A-Za-z][\w.-]*(?:\s[A-Z][\w.-]*)?|https?:\/\/[^\s]+)/g).filter(Boolean);
  return (
    <p>
      {parts.map((part, i) => {
        if (part.startsWith('@')) return <em key={i} className="ns-msg-mention">{part}</em>;
        if (part.startsWith('http')) {
          return <a key={i} className="ns-msg-link" href={part} target="_blank" rel="noreferrer">{part.replace(/^https?:\/\//, '')}</a>;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export function ChatDayRule({ label }: { label: string }) {
  return (
    <div className="ns-msg-day" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

export function ChatMessage({
  mine,
  grouped,
  name,
  at,
  body,
  kind,
  avatar,
  messageId,
  reactions,
  onToggleReaction,
  onReply,
}: {
  mine?: boolean;
  grouped?: boolean;
  name: string;
  at: string;
  body: string;
  kind?: string | null;
  avatar?: ReactNode;
  messageId: string;
  reactions?: Partial<Record<string, boolean>>;
  onToggleReaction: (emoji: string) => void;
  onReply: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const active = REACTION_SET.filter((emoji) => reactions?.[emoji]);
  return (
    <article className={`ns-msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}`}>
      {!mine && (grouped ? <div className="ns-msg-gutter"><span>{at}</span></div> : avatar)}
      <div className="ns-msg-col">
        {!grouped && (
          <header className="ns-msg-meta">
            <strong>{mine ? 'You' : name}</strong>
            <time>{at}</time>
          </header>
        )}
        <div className="ns-msg-bubble">
          <MessageText body={body} />
          {kind && kind !== 'message' && <small className={`message-kind kind-${kind}`}>{kind.replaceAll('_', ' ')}</small>}
          <div className="ns-msg-hover">
            <button type="button" title="React" onClick={() => setPicker((v) => !v)}><Smile size={14} /></button>
            <button type="button" title="Reply" onClick={onReply}><MessageCircle size={14} /></button>
          </div>
        </div>
        {(picker || active.length > 0) && (
          <div className="ns-msg-reacts">
            {REACTION_SET.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={reactions?.[emoji] ? 'on' : ''}
                onClick={() => { onToggleReaction(emoji); setPicker(false); }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder,
  kindLabel,
  reply,
  onClearReply,
  sendError,
  onRetry,
  sending,
  disabled,
  composerRef,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  placeholder: string;
  kindLabel?: string;
  reply?: ReplyTarget | null;
  onClearReply?: () => void;
  sendError?: string;
  onRetry?: () => void;
  sending?: boolean;
  disabled?: boolean;
  composerRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
}) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const ref = composerRef || innerRef;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value, ref]);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!value.trim() || sending || disabled) return;
    onSend();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  return (
    <form className="message-composer ns-composer" onSubmit={submit}>
      {sendError && (
        <div className="message-send-error" role="alert">
          {sendError}
          {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
        </div>
      )}
      {reply && (
        <div className="ns-reply-bar">
          <div>
            <small>Replying to {reply.name}</small>
            <span>{reply.body}</span>
          </div>
          {onClearReply && <button type="button" onClick={onClearReply} aria-label="Cancel reply"><X size={16} /></button>}
        </div>
      )}
      {kindLabel && kindLabel !== 'Message' && <div className="ns-composer-kind">{kindLabel}</div>}
      <div className="ns-composer-shell">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
        />
        <button type="submit" className="ns-send-fab" disabled={disabled || sending || !value.trim()} aria-label={sending ? 'Sending' : 'Send'}>
          <Send size={16} />
        </button>
      </div>
      <p className="message-composer-hint">Enter to send · Shift+Enter for a new line</p>
    </form>
  );
}
