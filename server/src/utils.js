import { db } from './db.js';

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
export const isNickname = (value) => /^[\p{L}\p{N}_]{3,20}$/u.test(String(value || ''));

export function publicUser(row, { own = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    email: own || !row.hide_email ? row.email : null,
    nickname: row.nickname,
    hideEmail: Boolean(row.hide_email),
    avatar: row.avatar,
    verified: Boolean(row.verified),
    createdAt: row.created_at
  };
}

export function decorateMessage(row) {
  if (!row) return null;
  const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(row.sender_id);
  return {
    id: row.id,
    chatId: row.chat_id,
    text: row.deleted ? '' : row.text,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deleted: Boolean(row.deleted),
    sender: sender
      ? {
          id: sender.id,
          nickname: sender.nickname,
          avatar: sender.avatar,
          email: sender.hide_email ? null : sender.email
        }
      : null,
    forwardedFrom: row.forwarded_from ? JSON.parse(row.forwarded_from) : null
  };
}

export function chatSummary(chatId, userId) {
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  if (!chat) return null;

  const membership = db
    .prepare('SELECT muted, last_read_at FROM chat_members WHERE chat_id = ? AND user_id = ?')
    .get(chatId, userId);
  if (!membership) return null;

  const members = db
    .prepare(`
      SELECT u.* FROM chat_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.chat_id = ?
      ORDER BY u.created_at ASC
    `)
    .all(chatId)
    .map((user) => publicUser(user, { own: user.id === userId }));

  const lastRow = db
    .prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
    .get(chatId);
  const unreadCount = db
    .prepare(`
      SELECT COUNT(*) AS count FROM messages
      WHERE chat_id = ? AND sender_id <> ? AND deleted = 0 AND created_at > ?
    `)
    .get(chatId, userId, membership.last_read_at).count;

  const other = chat.type === 'direct' ? members.find((member) => member.id !== userId) : null;

  return {
    id: chat.id,
    type: chat.type,
    name: chat.type === 'group' ? chat.name : other?.nickname || other?.email || 'Пользователь',
    avatar: chat.type === 'group' ? chat.avatar : other?.avatar || null,
    createdAt: chat.created_at,
    muted: Boolean(membership.muted),
    lastReadAt: membership.last_read_at,
    members,
    lastMessage: decorateMessage(lastRow),
    unreadCount
  };
}

export function assertMember(chatId, userId) {
  return Boolean(
    db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, userId)
  );
}

export function isContact(userId, otherId) {
  return Boolean(
    db.prepare('SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?').get(userId, otherId)
  );
}
