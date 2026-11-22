import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, BellOff, LogOut, Send, Smile, UserRoundPlus, UsersRound, X } from 'lucide-react';
import Avatar from './Avatar.jsx';
import Message from './Message.jsx';
import { displayName, formatDay } from '../lib/format.js';

export default function ChatWindow({
  chat,
  me,
  messages,
  typingUsers,
  online,
  editTarget,
  onClearEdit,
  onBack,
  onMessageMenu,
  onToggleMute,
  onAddMembers,
  onLeave,
  onSend,
  onSaveEdit,
  onTyping
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!editTarget) return;
    setEditing(editTarget);
    setDraft(editTarget.text || '');
    onClearEdit();
    requestAnimationFrame(() => textareaRef.current?.focus());
    // onClearEdit is intentionally omitted: editing must not be reset by unrelated re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [messages.length, chat.id, typingUsers.length]);

  function resizeTextarea(element) {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 130)}px`;
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    if (editing) {
      await onSaveEdit(editing.id, text);
      setEditing(null);
    } else {
      await onSend(text);
    }
    setDraft('');
    onTyping(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  const peer = chat.type === 'direct' ? chat.members.find((member) => member.id !== me.id) : null;
  const subtitle = chat.type === 'group'
    ? `${chat.members.length} участников`
    : online.has(peer?.id) ? 'в сети' : 'не в сети';
  const typingNames = typingUsers
    .map((id) => chat.members.find((member) => member.id === id))
    .filter(Boolean)
    .map(displayName);

  let previousDay = null;

  return (
    <section className="chat-window">
      <header className="chat-header">
        <button type="button" className="icon-button mobile-back" onClick={onBack} aria-label="Назад"><ArrowLeft size={20} /></button>
        <Avatar
          user={chat.type === 'group' ? { id: chat.id, avatar: chat.avatar, nickname: chat.name } : peer}
          size={46}
          online={chat.type === 'direct' && online.has(peer?.id)}
        />
        <div className="chat-header-info">
          <h2>{chat.name}</h2>
          <span className={chat.type === 'direct' && online.has(peer?.id) ? 'status-online' : ''}>{subtitle}</span>
        </div>
        <div className="chat-actions">
          {chat.type === 'group' && (
            <>
              <button type="button" className="icon-button" onClick={onAddMembers} title="Добавить участника"><UserRoundPlus size={19} /></button>
              <button type="button" className="icon-button" onClick={onLeave} title="Покинуть группу"><LogOut size={19} /></button>
            </>
          )}
          <button type="button" className={`icon-button ${chat.muted ? 'is-active' : ''}`} onClick={() => onToggleMute(chat.id, !chat.muted)} title={chat.muted ? 'Включить оповещения' : 'Отключить оповещения'}>
            {chat.muted ? <BellOff size={19} /> : <Bell size={19} />}
          </button>
        </div>
      </header>

      <div className="messages-scroll" ref={scrollRef}>
        <div className="messages-inner">
          {messages.length === 0 && (
            <div className="messages-empty">
              <div className="empty-bubble"><UsersRound size={28} /></div>
              <strong>Здесь пока тихо</strong>
              <span>Напишите первое сообщение и начните разговор</span>
            </div>
          )}

          {messages.map((message) => {
            const day = formatDay(message.createdAt);
            const showDay = day !== previousDay;
            previousDay = day;
            return (
              <div key={message.id}>
                {showDay && <div className="day-separator"><span>{day}</span></div>}
                <Message message={message} meId={me.id} onContextMenu={onMessageMenu} />
              </div>
            );
          })}

          {typingNames.length > 0 && (
            <div className="typing-row">
              <div className="typing-avatar"><Avatar user={chat.members.find((member) => member.id === typingUsers[0])} size={26} /></div>
              <div className="typing-bubble"><i /><i /><i /></div>
              <span>{typingNames.join(', ')} {typingNames.length > 1 ? 'печатают' : 'печатает'}…</span>
            </div>
          )}
        </div>
      </div>

      <div className="composer">
        {editing && (
          <div className="editing-banner">
            <span>Редактирование сообщения</span>
            <button type="button" onClick={() => { setEditing(null); setDraft(''); }} aria-label="Отменить редактирование"><X size={16} /></button>
          </div>
        )}
        <div className={`composer-box ${editing ? 'editing' : ''}`}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            placeholder="Напишите сообщение…"
            onChange={(event) => {
              setDraft(event.target.value);
              resizeTextarea(event.target);
              onTyping(event.target.value.trim().length > 0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <button type="button" className="icon-button composer-emoji" title="Добавить эмодзи" onClick={() => { setDraft((value) => `${value}🙂`); textareaRef.current?.focus(); }}>
            <Smile size={19} />
          </button>
          <button type="button" className="send-button" onClick={handleSend} disabled={!draft.trim()} title="Отправить"><Send size={18} /></button>
        </div>
        <div className="composer-hint">Enter — отправить · Shift + Enter — новая строка · правый клик по сообщению — действия</div>
      </div>
    </section>
  );
}
