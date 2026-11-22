import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Forward, MessageCircleMore, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { api, clearToken, getToken, saveToken } from './api.js';
import { playMessageSound, unlockAudio } from './lib/sound.js';
import { messagePreview } from './lib/format.js';
import AuthScreen from './components/AuthScreen.jsx';
import Avatar from './components/Avatar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import GroupModal from './components/GroupModal.jsx';
import PeoplePicker from './components/PeoplePicker.jsx';
import ProfileModal from './components/ProfileModal.jsx';
import Rail from './components/Rail.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toasts from './components/Toasts.jsx';

export default function App() {
  const [token, setToken] = useState(getToken());
  const [me, setMe] = useState(null);
  const [chats, setChats] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState('chats');
  const [online, setOnline] = useState(new Set());
  const [typing, setTyping] = useState({});
  const [modal, setModal] = useState(null);
  const [menu, setMenu] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [booting, setBooting] = useState(Boolean(getToken()));
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const socketRef = useRef(null);
  const activeChatRef = useRef(activeChatId);
  const meRef = useRef(me);
  const chatsRef = useRef(chats);
  const lastTypingRef = useRef(0);

  useEffect(() => { activeChatRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);

  const toast = useCallback((text, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, text, type }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3500);
  }, []);

  const refreshChats = useCallback(async () => {
    try {
      const data = await api.get('/chats');
      setChats(data.chats);
    } catch (error) {
      if (error.status === 401) {
        clearToken();
        setToken(null);
      } else toast(error.message, 'error');
    }
  }, [toast]);

  const refreshContacts = useCallback(async () => {
    try {
      const data = await api.get('/contacts');
      setContacts(data.contacts);
    } catch (error) {
      if (error.status === 401) {
        clearToken();
        setToken(null);
      } else toast(error.message, 'error');
    }
  }, [toast]);

  // Initial data loading
  useEffect(() => {
    if (!token) {
      setMe(null);
      setChats([]);
      setContacts([]);
      setBooting(false);
      return undefined;
    }

    let cancelled = false;
    setBooting(true);
    Promise.all([api.get('/users/me'), api.get('/contacts'), api.get('/chats')])
      .then(([meData, contactsData, chatsData]) => {
        if (cancelled) return;
        setMe(meData.user);
        setContacts(contactsData.contacts);
        setChats(chatsData.chats);
      })
      .catch((error) => {
        if (error.status === 401) {
          clearToken();
          setToken(null);
        } else if (!cancelled) toast(error.message, 'error');
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });

    return () => { cancelled = true; };
  }, [token, toast]);

  const handleRealtime = useCallback((payload) => {
    switch (payload.type) {
      case 'hello':
        setOnline(new Set(payload.onlineUsers || []));
        break;

      case 'presence':
        setOnline((current) => {
          const next = new Set(current);
          if (payload.online) next.add(payload.userId);
          else next.delete(payload.userId);
          return next;
        });
        break;

      case 'message:new': {
        const message = payload.message;
        const currentMe = meRef.current;
        const mine = message.sender?.id === currentMe?.id;
        const isActive = message.chatId === activeChatRef.current;

        setMessages((current) => (isActive ? [...current, message] : current));
        setChats((current) => {
          if (!current.some((chat) => chat.id === message.chatId)) {
            setTimeout(() => refreshChats(), 0);
            return current;
          }
          return current
            .map((chat) =>
              chat.id === message.chatId
                ? {
                    ...chat,
                    lastMessage: message,
                    unreadCount: mine || isActive ? chat.unreadCount : chat.unreadCount + 1
                  }
                : chat
            )
            .sort(
              (a, b) =>
                (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt)
            );
        });

        if (isActive && !mine) {
          socketRef.current?.send(JSON.stringify({ type: 'read', chatId: message.chatId }));
        } else if (!mine) {
          const chat = chatsRef.current.find((item) => item.id === message.chatId);
          if (!chat?.muted) {
            playMessageSound();
            toast(`${message.sender?.nickname || 'Новое сообщение'}: ${messagePreview(message)}`, 'info');
          }
        }
        break;
      }

      case 'message:edited':
        setMessages((current) => current.map((item) => (item.id === payload.message.id ? payload.message : item)));
        setChats((current) =>
          current.map((chat) =>
            chat.lastMessage?.id === payload.message.id ? { ...chat, lastMessage: payload.message } : chat
          )
        );
        break;

      case 'message:deleted':
        setMessages((current) =>
          current.map((item) => (item.id === payload.id ? { ...item, deleted: true, text: '' } : item))
        );
        setChats((current) =>
          current.map((chat) =>
            chat.lastMessage?.id === payload.id
              ? { ...chat, lastMessage: { ...chat.lastMessage, deleted: true, text: '' } }
              : chat
          )
        );
        break;

      case 'chat:new':
      case 'chat:updated':
        refreshChats();
        break;

      case 'chat:removed':
        setChats((current) => current.filter((chat) => chat.id !== payload.chatId));
        if (activeChatRef.current === payload.chatId) {
          setActiveChatId(null);
          setMobileChatOpen(false);
        }
        break;

      case 'chat:read':
        if (payload.userId === meRef.current?.id) {
          setChats((current) =>
            current.map((chat) => (chat.id === payload.chatId ? { ...chat, unreadCount: 0 } : chat))
          );
        }
        break;

      case 'typing':
        setTyping((current) => {
          const existing = current[payload.chatId] || [];
          const next = payload.isTyping
            ? existing.includes(payload.userId) ? existing : [...existing, payload.userId]
            : existing.filter((id) => id !== payload.userId);
          return { ...current, [payload.chatId]: next };
        });
        break;

      default:
        break;
    }
  }, [refreshChats, toast]);

  // WebSocket connection
  useEffect(() => {
    if (!token) return undefined;
    let disposed = false;
    let reconnectTimer = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          handleRealtime(JSON.parse(event.data));
        } catch {
          /* ignore malformed events */
        }
      };
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (!disposed) reconnectTimer = setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [token, handleRealtime]);

  // Load messages when a chat is opened (also marks it as read on the server)
  useEffect(() => {
    if (!activeChatId || !token) {
      setMessages([]);
      return undefined;
    }
    let cancelled = false;
    setMessages([]);
    api.get(`/chats/${activeChatId}/messages?limit=60`)
      .then((data) => { if (!cancelled) setMessages(data.messages); })
      .catch((error) => { if (!cancelled) toast(error.message, 'error'); })
      .finally(() => { if (!cancelled) refreshChats(); });
    return () => { cancelled = true; };
  }, [activeChatId, token, refreshChats, toast]);

  function handleAuthenticated(data) {
    unlockAudio();
    saveToken(data.token);
    setToken(data.token);
    setMe(data.user);
    toast('Добро пожаловать в Pulse!', 'success');
  }

  function handleLogout() {
    clearToken();
    setToken(null);
    setMe(null);
    setChats([]);
    setContacts([]);
    setActiveChatId(null);
    setMobileChatOpen(false);
    setTab('chats');
    toast('Вы вышли из аккаунта', 'info');
  }

  function selectChat(chatId) {
    if (activeChatRef.current && activeChatRef.current !== chatId) {
      socketRef.current?.send(JSON.stringify({ type: 'typing', chatId: activeChatRef.current, isTyping: false }));
    }
    setActiveChatId(chatId);
    setTab('chats');
    setMobileChatOpen(true);
    setTyping((current) => ({ ...current, [chatId]: [] }));
  }

  async function selectContact(contact) {
    try {
      const data = await api.post('/chats/direct', { userId: contact.id });
      await refreshChats();
      selectChat(data.chat.id);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function handleAddContact(contact) {
    if (contacts.some((item) => item.id === contact.id)) {
      setModal(null);
      toast('Этот пользователь уже в контактах', 'info');
      return;
    }
    try {
      await api.post('/contacts', { userId: contact.id });
      await refreshContacts();
      setModal(null);
      toast('Контакт добавлен', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function createGroup(name, memberIds) {
    try {
      const data = await api.post('/chats/group', { name, memberIds });
      await refreshChats();
      setModal(null);
      selectChat(data.chat.id);
      toast('Групповой чат создан', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function addMembers(chatId, memberIds) {
    try {
      await Promise.all(memberIds.map((userId) => api.post(`/chats/${chatId}/members`, { userId })));
      await refreshChats();
      setModal(null);
      toast('Участники добавлены', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function toggleMute(chatId, muted) {
    try {
      await api.patch(`/chats/${chatId}/mute`, { muted });
      await refreshChats();
      toast(muted ? 'Оповещения отключены' : 'Оповещения включены', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function leaveGroup(chatId) {
    if (!window.confirm('Покинуть групповой чат?')) return;
    try {
      await api.delete(`/chats/${chatId}/members/${me.id}`);
      await refreshChats();
      setActiveChatId(null);
      setMobileChatOpen(false);
      toast('Вы покинули группу', 'info');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function sendMessage(text) {
    try {
      await api.post(`/chats/${activeChatRef.current}/messages`, { text });
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function saveEdit(messageId, text) {
    try {
      await api.patch(`/messages/${messageId}`, { text });
      toast('Сообщение изменено', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function forwardMessage(message, contact) {
    try {
      const originalText = message.text || message.forwardedFrom?.text || 'Без текста';
      const data = await api.post('/chats/direct', { userId: contact.id });
      await api.post(`/chats/${data.chat.id}/messages`, {
        text: '',
        forwardedFrom: {
          senderName: message.sender?.nickname || message.sender?.email || 'Участник',
          text: originalText,
          createdAt: message.createdAt
        }
      });
      await refreshChats();
      setModal(null);
      toast('Сообщение переслано', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function handleTyping(isTyping) {
    const chatId = activeChatRef.current;
    if (!chatId) return;
    const now = Date.now();
    if (isTyping && now - lastTypingRef.current < 1000) return;
    lastTypingRef.current = isTyping ? now : 0;
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'typing', chatId, isTyping }));
    }
  }

  function openChatMenu(event, chat) {
    event.preventDefault();
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: 'Открыть чат', icon: <MessageCircleMore size={16} />, onClick: () => selectChat(chat.id) },
        {
          label: chat.muted ? 'Включить оповещения' : 'Отключить оповещения',
          icon: chat.muted ? <Bell size={16} /> : <BellOff size={16} />,
          onClick: () => toggleMute(chat.id, !chat.muted)
        }
      ]
    });
  }

  function openMessageMenu(event, message) {
    event.preventDefault();
    const items = [];
    if (message.sender?.id === me.id && !message.deleted) {
      items.push({
        label: 'Редактировать сообщение',
        icon: <Pencil size={16} />,
        onClick: () => setEditTarget({ ...message, editNonce: Date.now() })
      });
    }
    if (message.sender?.id === me.id) {
      items.push({
        label: 'Удалить сообщение',
        icon: <Trash2 size={16} />,
        danger: true,
        onClick: async () => {
          if (!window.confirm('Удалить это сообщение?')) return;
          try {
            await api.delete(`/messages/${message.id}`);
            toast('Сообщение удалено', 'success');
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      });
    }
    items.push({
      label: 'Переслать сообщение',
      icon: <Forward size={16} />,
      onClick: () => setModal({ type: 'forward', message })
    });
    setMenu({ x: event.clientX, y: event.clientY, items });
  }

  function renderModal() {
    if (!modal) return null;

    if (modal.type === 'profile') {
      return (
        <ProfileModal
          user={me}
          onClose={() => setModal(null)}
          onSaved={(user) => {
            setMe(user);
            setModal(null);
            refreshChats();
            refreshContacts();
            toast('Профиль обновлён', 'success');
          }}
        />
      );
    }

    if (modal.type === 'newGroup') {
      return <GroupModal contacts={contacts} online={online} onConfirm={createGroup} onClose={() => setModal(null)} />;
    }

    if (modal.type === 'newChat') {
      return (
        <PeoplePicker
          title="Новый чат"
          subtitle="Выберите контакт или найдите нового пользователя"
          contacts={contacts}
          online={online}
          confirmLabel="Написать"
          onConfirm={(user) => { setModal(null); selectContact(user); }}
          onContactAdded={refreshContacts}
          onClose={() => setModal(null)}
        />
      );
    }

    if (modal.type === 'addContact') {
      return (
        <PeoplePicker
          title="Добавить контакт"
          subtitle="Поиск по нику или email (если он не скрыт)"
          contacts={contacts}
          online={online}
          confirmLabel="Добавить"
          onConfirm={handleAddContact}
          onContactAdded={refreshContacts}
          onClose={() => setModal(null)}
        />
      );
    }

    if (modal.type === 'forward') {
      return (
        <PeoplePicker
          title="Переслать сообщение"
          subtitle={`«${messagePreview(modal.message)}»`}
          contacts={contacts}
          online={online}
          confirmLabel="Переслать"
          onConfirm={(contact) => forwardMessage(modal.message, contact)}
          onContactAdded={refreshContacts}
          onClose={() => setModal(null)}
        />
      );
    }

    if (modal.type === 'addMember' && activeChat) {
      return (
        <PeoplePicker
          mode="multi"
          title="Добавить участников"
          subtitle="Доступны только ваши контакты"
          contacts={contacts}
          online={online}
          excludeIds={activeChat.members.map((member) => member.id)}
          confirmLabel="Добавить в чат"
          onConfirm={(ids) => addMembers(activeChat.id, ids)}
          onContactAdded={refreshContacts}
          onClose={() => setModal(null)}
        />
      );
    }

    return null;
  }

  if (!token) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} />
        <Toasts toasts={toasts} />
      </>
    );
  }

  if (booting || !me) {
    return (
      <div className="boot-screen">
        <div className="boot-logo"><MessageCircleMore size={34} /></div>
        <div className="loader" />
        <span>Загружаем ваши чаты…</span>
      </div>
    );
  }

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;
  const unreadTotal = chats.reduce((sum, chat) => sum + (chat.muted ? 0 : chat.unreadCount), 0);

  return (
    <div className={`app-shell ${mobileChatOpen && activeChat ? 'show-chat' : ''}`}>
      <Rail
        tab={tab}
        setTab={setTab}
        me={me}
        unreadTotal={unreadTotal}
        onProfile={() => setModal({ type: 'profile' })}
        onLogout={handleLogout}
      />

      <Sidebar
        tab={tab}
        setTab={setTab}
        chats={chats}
        contacts={contacts}
        activeChatId={activeChatId}
        meId={me.id}
        online={online}
        onSelectChat={selectChat}
        onSelectContact={selectContact}
        onChatMenu={openChatMenu}
        onNewChat={() => setModal({ type: 'newChat' })}
        onNewGroup={() => setModal({ type: 'newGroup' })}
        onAddContact={() => setModal({ type: 'addContact' })}
      />

      {activeChat ? (
        <ChatWindow
          key={activeChat.id}
          chat={activeChat}
          me={me}
          messages={messages}
          typingUsers={typing[activeChat.id] || []}
          online={online}
          editTarget={editTarget}
          onClearEdit={() => setEditTarget(null)}
          onBack={() => setMobileChatOpen(false)}
          onMessageMenu={openMessageMenu}
          onToggleMute={toggleMute}
          onAddMembers={() => setModal({ type: 'addMember' })}
          onLeave={() => leaveGroup(activeChat.id)}
          onSend={sendMessage}
          onSaveEdit={saveEdit}
          onTyping={handleTyping}
        />
      ) : (
        <section className="chat-placeholder">
          <div className="placeholder-art">
            <div className="placeholder-orb"><MessageCircleMore size={54} strokeWidth={1.6} /></div>
            <span className="floating-chip chip-one"><Sparkles size={14} /> реальное время</span>
            <span className="floating-chip chip-two">✦ асинхронно</span>
          </div>
          <h2>Выберите чат, чтобы начать</h2>
          <p>Здесь появятся ваши сообщения. Напишите другу или создайте группу для обсуждения.</p>
          <button type="button" className="primary-button" onClick={() => setModal({ type: 'newChat' })}>Начать переписку</button>
        </section>
      )}

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      {renderModal()}
      <Toasts toasts={toasts} />
    </div>
  );
}
