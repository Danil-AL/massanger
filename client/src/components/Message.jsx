import { Forward, Pencil } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { formatTime } from '../lib/format.js';

export default function Message({ message, meId, onContextMenu }) {
  const own = message.sender?.id === meId;
  return (
    <div className={`message-row ${own ? 'own' : ''}`} onContextMenu={(event) => onContextMenu(event, message)}>
      {!own && <Avatar user={message.sender} size={30} className="message-avatar" />}
      <div className={`message-bubble ${message.deleted ? 'deleted' : ''} ${message.forwardedFrom ? 'has-forward' : ''}`}>
        {!own && message.sender?.nickname && <div className="message-author">{message.sender.nickname}</div>}
        {message.forwardedFrom && (
          <div className="forwarded-block">
            <div className="forwarded-title"><Forward size={12} /> Пересланное сообщение · {message.forwardedFrom.senderName}</div>
            <div className="forwarded-text">{message.forwardedFrom.text}</div>
          </div>
        )}
        {message.deleted ? (
          <div className="deleted-text">Сообщение удалено</div>
        ) : (
          message.text && <div className="message-text">{message.text}</div>
        )}
        <div className="message-meta">
          {message.editedAt && !message.deleted && <span><Pencil size={10} /> изменено</span>}
          <time>{formatTime(message.createdAt)}</time>
          {own && <span className="read-check">✓✓</span>}
        </div>
      </div>
    </div>
  );
}
