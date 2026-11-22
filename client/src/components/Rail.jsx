import { LogOut, MessageSquare, Settings2, UsersRound } from 'lucide-react';
import Avatar from './Avatar.jsx';

export default function Rail({ tab, setTab, me, unreadTotal, onProfile, onLogout }) {
  return (
    <nav className="rail" aria-label="Основная навигация">
      <div className="rail-logo" title="Pulse"><span>◈</span></div>

      <div className="rail-nav">
        <button type="button" className={tab === 'chats' ? 'active' : ''} onClick={() => setTab('chats')} title="Чаты">
          <MessageSquare size={21} />
          {unreadTotal > 0 && <i className="rail-badge">{unreadTotal > 9 ? '9+' : unreadTotal}</i>}
        </button>
        <button type="button" className={tab === 'contacts' ? 'active' : ''} onClick={() => setTab('contacts')} title="Контакты">
          <UsersRound size={21} />
        </button>
      </div>

      <div className="rail-bottom">
        <button type="button" onClick={onProfile} title="Настройки профиля"><Settings2 size={21} /></button>
        <Avatar user={me} size={42} onClick={onProfile} className="rail-avatar" />
        <button type="button" onClick={onLogout} title="Выйти"><LogOut size={20} /></button>
      </div>
    </nav>
  );
}
