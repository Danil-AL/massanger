import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { assertMember, chatSummary, decorateMessage, isContact } from '../utils.js';
import { emitToChat, emitToUser } from '../realtime.js';

const router = Router();
router.use(requireAuth);

function listForUser(userId) {
  return db
    .prepare(`
      SELECT c.* FROM chats c
      JOIN chat_members cm ON cm.chat_id = c.id
      WHERE cm.user_id = ?
    `)
    .all(userId)
    .map((chat) => chatSummary(chat.id, userId))
    .filter(Boolean)
    .sort(
      (a, b) =>
        (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt)
    );
}

router.get('/', (req, res) => {
  res.json({ chats: listForUser(req.user.id) });
});

router.post('/direct', (req, res) => {
  const userId = String(req.body?.userId || '').trim();
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND verified = 1').get(userId);
  if (!target) return res.status(404).json({ message: 'Пользователь не найден' });
  if (target.id === req.user.id) return res.status(400).json({ message: 'Нельзя начать чат с собой' });
  if (!isContact(req.user.id, target.id)) {
    return res.status(403).json({ message: 'Сначала добавьте пользователя в контакты' });
  }

  const directKey = [req.user.id, target.id].sort().join(':');
  let chat = db.prepare('SELECT * FROM chats WHERE direct_key = ?').get(directKey);

  if (!chat) {
    const chatId = crypto.randomUUID();
    const now = Date.now();
    db.transaction(() => {
      db.prepare(`
        INSERT INTO chats (id, type, name, avatar, direct_key, created_by, created_at)
        VALUES (?, 'direct', NULL, NULL, ?, ?, ?)
      `).run(chatId, directKey, req.user.id, now);
      const insertMember = db.prepare(`
        INSERT INTO chat_members (chat_id, user_id, last_read_at, muted, joined_at)
        VALUES (?, ?, ?, 0, ?)
      `);
      insertMember.run(chatId, req.user.id, now, now);
      insertMember.run(chatId, target.id, now, now);
    })();
    chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    emitToChat(chatId, { type: 'chat:new', chatId });
  }

  return res.status(201).json({ chat: chatSummary(chat.id, req.user.id) });
});

router.post('/group', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const memberIds = Array.isArray(req.body?.memberIds) ? [...new Set(req.body.memberIds)] : [];
  if (name.length < 1 || name.length > 50) {
    return res.status(400).json({ message: 'Название группы: от 1 до 50 символов' });
  }
  if (memberIds.length < 1) {
    return res.status(400).json({ message: 'Добавьте хотя бы одного участника из контактов' });
  }
  if (memberIds.some((id) => typeof id !== 'string' || id === req.user.id)) {
    return res.status(400).json({ message: 'Некорректный список участников' });
  }
  for (const id of memberIds) {
    if (!isContact(req.user.id, id)) {
      return res.status(403).json({ message: 'В группу можно добавлять только свои контакты' });
    }
  }

  const chatId = crypto.randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO chats (id, type, name, avatar, direct_key, created_by, created_at)
      VALUES (?, 'group', ?, NULL, NULL, ?, ?)
    `).run(chatId, name, req.user.id, now);
    const insertMember = db.prepare(`
      INSERT INTO chat_members (chat_id, user_id, last_read_at, muted, joined_at)
      VALUES (?, ?, ?, 0, ?)
    `);
    insertMember.run(chatId, req.user.id, now, now);
    for (const id of memberIds) insertMember.run(chatId, id, now, now);
  })();

  emitToChat(chatId, { type: 'chat:new', chatId });
  return res.status(201).json({ chat: chatSummary(chatId, req.user.id) });
});

router.patch('/:id/mute', (req, res) => {
  if (!assertMember(req.params.id, req.user.id)) {
    return res.status(403).json({ message: 'Вы не участник этого чата' });
  }
  const muted = Boolean(req.body?.muted);
  db.prepare('UPDATE chat_members SET muted = ? WHERE chat_id = ? AND user_id = ?').run(
    muted ? 1 : 0,
    req.params.id,
    req.user.id
  );
  emitToUser(req.user.id, { type: 'chat:updated', chatId: req.params.id });
  return res.json({ muted });
});

router.post('/:id/members', (req, res) => {
  if (!assertMember(req.params.id, req.user.id)) {
    return res.status(403).json({ message: 'Вы не участник этого чата' });
  }
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
  if (chat.type !== 'group') return res.status(400).json({ message: 'Это не групповой чат' });

  const userId = String(req.body?.userId || '').trim();
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND verified = 1').get(userId);
  if (!target) return res.status(404).json({ message: 'Пользователь не найден' });
  if (!isContact(req.user.id, target.id)) {
    return res.status(403).json({ message: 'В чат можно добавлять только свои контакты' });
  }
  if (assertMember(chat.id, target.id)) {
    return res.status(409).json({ message: 'Пользователь уже в чате' });
  }

  db.prepare(`
    INSERT INTO chat_members (chat_id, user_id, last_read_at, muted, joined_at)
    VALUES (?, ?, ?, 0, ?)
  `).run(chat.id, target.id, Date.now(), Date.now());
  emitToChat(chat.id, { type: 'chat:updated', chatId: chat.id });
  return res.status(201).json({ chat: chatSummary(chat.id, req.user.id) });
});

router.delete('/:id/members/:userId', (req, res) => {
  if (!assertMember(req.params.id, req.user.id)) {
    return res.status(403).json({ message: 'Вы не участник этого чата' });
  }
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
  if (req.params.userId !== req.user.id && chat.created_by !== req.user.id) {
    return res.status(403).json({ message: 'Удалять участников может только создатель' });
  }

  db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?').run(
    req.params.id,
    req.params.userId
  );
  emitToChat(req.params.id, { type: 'chat:updated', chatId: req.params.id });
  emitToUser(req.params.userId, { type: 'chat:removed', chatId: req.params.id });
  return res.json({ ok: true });
});

router.get('/:id/messages', (req, res) => {
  if (!assertMember(req.params.id, req.user.id)) {
    return res.status(403).json({ message: 'Вы не участник этого чата' });
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
  const before = Number(req.query.before) || Date.now() + 1;
  const rows = db
    .prepare(`
      SELECT * FROM messages
      WHERE chat_id = ? AND created_at < ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    `)
    .all(req.params.id, before, limit);

  const now = Date.now();
  db.prepare('UPDATE chat_members SET last_read_at = ? WHERE chat_id = ? AND user_id = ?').run(
    now,
    req.params.id,
    req.user.id
  );
  emitToChat(req.params.id, {
    type: 'chat:read',
    chatId: req.params.id,
    userId: req.user.id,
    lastReadAt: now
  });

  return res.json({
    messages: rows.reverse().map(decorateMessage),
    hasMore: rows.length === limit
  });
});

router.post('/:id/messages', (req, res) => {
  if (!assertMember(req.params.id, req.user.id)) {
    return res.status(403).json({ message: 'Вы не участник этого чата' });
  }
  const text = String(req.body?.text || '').trim();

  let forwardedFrom = null;
  if (req.body?.forwardedFrom) {
    forwardedFrom = {
      senderName: String(req.body.forwardedFrom.senderName || 'Неизвестно').slice(0, 60),
      text: String(req.body.forwardedFrom.text || '').slice(0, 4000),
      createdAt: Number(req.body.forwardedFrom.createdAt) || Date.now()
    };
  }
  if ((!text && !forwardedFrom) || (text && text.length > 4000)) {
    return res.status(400).json({ message: 'Сообщение должно содержать от 1 до 4000 символов' });
  }

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  db.prepare(`
    INSERT INTO messages (id, chat_id, sender_id, text, created_at, edited_at, deleted, forwarded_from)
    VALUES (?, ?, ?, ?, ?, NULL, 0, ?)
  `).run(id, req.params.id, req.user.id, text, createdAt, forwardedFrom ? JSON.stringify(forwardedFrom) : null);
  db.prepare('UPDATE chat_members SET last_read_at = ? WHERE chat_id = ? AND user_id = ?').run(
    createdAt,
    req.params.id,
    req.user.id
  );

  const message = decorateMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(id));
  emitToChat(req.params.id, { type: 'message:new', message });
  return res.status(201).json({ message });
});

export default router;
