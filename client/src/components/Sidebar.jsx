import { useState } from 'react';
import { BellOff, MessageCircleMore, Plus, Search, SquarePen, UserRoundPlus, UsersRound } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { displayName, formatChatTime, messagePreview } from '../lib/format.js';

export default function Sidebar({
  tab,
  setTab,
  chats,
  contacts,
  activeChatId,
  meId,
  online,
  onSelectChat,
  onSelectContact,
  onChatMenu,
  onNewChat,
  onNewGroup,
  onAddContact
}) {
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const filteredChats = chats.filter(
    (chat) =>
      !needle ||
      chat.name.toLowerCase().includes(needle) ||
      messagePreview(chat.lastMessage).toLowerCase().includes(needle)
  );
  const filteredContacts = contacts.filter(
    (contact) =>
      !needle ||
      displayName(contact).toLowerCase().includes(needle) ||
      (contact.email || '').toLowerCase().includes(needle)
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-title">
          <h2>{tab === 'chats' ? 'Сообщения' : 'Контакты'}</h2>
          <button type="button" className="icon-button primary-soft" onClick={tab === 'chats' ? onNewChat : onAddContact} title={tab === 'chats' ? 'Новый чат' : 'Добавить контакт'}>
            {tab === 'chats' ? <SquarePen size={19} /> : <UserRoundPlus size={19} />}
          </button>
        </div>

        <div className="search-field">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'chats' ? 'Поиск по чатам' : 'Поиск по контактам'} />
        </div>

        <div className="sidebar-tabs">
          <button type="button" className={tab === 'chats' ? 'active' : ''} onClick={() => setTab('chats')}>
            Чаты {chats.length > 0 && <span>{chats.length}</span>}
          </button>
          <button type="button" className={tab === 'contacts' ? 'active' : ''} onClick={() => setTab('contacts')}>
            Контакты {contacts.length > 0 && <span>{contacts.length}</span>}
          </button>
          <button type="button" className="group-action" onClick={onNewGroup} title="Создать группу"><Plus size={17} /></button>
        </div>
      </div>

      <div className="list-scroll">
        {tab === 'chats' ? (
          filteredChats.length ? (
            filteredChats.map((chat) => {
              const other = chat.type === 'direct'
                ? chat.members.find((member) => member.id !== meId) || chat.members[0]
                : chat.members[0];
              return (
                <button
                  key={chat.id}
                  type="button"
                  className={`chat-item ${activeChatId === chat.id ? 'active' : ''} ${chat.muted ? 'muted' : ''}`}
                  onClick={() => onSelectChat(chat.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onChatMenu(event, chat);
                  }}
                >
                  <Avatar
                    user={chat.type === 'group' ? { avatar: chat.avatar, id: chat.id, nickname: chat.name } : other}
                    size={50}
                    online={chat.type === 'direct' && online.has(other?.id)}
                  />
                  <span className="chat-item-body">
                    <span className="chat-item-top">
                      <strong>{chat.name}</strong>
                      <time>{formatChatTime(chat.lastMessage?.createdAt || chat.createdAt)}</time>
                    </span>
                    <span className="chat-item-bottom">
                      <span className={`preview ${chat.unreadCount ? 'unread-preview' : ''}`}>
                        {chat.type === 'group' && chat.lastMessage && !chat.lastMessage.deleted
                          ? `${chat.lastMessage.sender?.nickname || 'Участник'}: ${messagePreview(chat.lastMessage)}`
                          : messagePreview(chat.lastMessage)}
                      </span>
                      {chat.muted && <BellOff size={14} className="muted-icon" />}
                      {chat.unreadCount > 0 && <i className="unread-badge">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</i>}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="list-empty">
              <MessageCircleMore size={34} />
              <strong>{needle ? 'Чаты не найдены' : 'Пока нет чатов'}</strong>
              <span>{needle ? 'Попробуйте другой запрос' : 'Начните переписку — нажмите на карандаш'}</span>
            </div>
          )
        ) : filteredContacts.length ? (
          filteredContacts.map((contact) => (
            <button key={contact.id} type="button" className="contact-item" onClick={() => onSelectContact(contact)}>
              <Avatar user={contact} size={46} online={online.has(contact.id)} />
              <span className="contact-info">
                <strong>{displayName(contact)}</strong>
                <small>{contact.email || 'Email скрыт'}</small>
              </span>
              <span className="contact-arrow">→</span>
            </button>
          ))
        ) : (
          <div className="list-empty">
            <UsersRound size={34} />
            <strong>{needle ? 'Контакты не найдены' : 'Список контактов пуст'}</strong>
            <span>{needle ? 'Попробуйте другой запрос' : 'Найдите людей и добавьте их в контакты'}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
