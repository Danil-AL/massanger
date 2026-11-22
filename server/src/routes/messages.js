import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { decorateMessage } from '../utils.js';
import { emitToChat } from '../realtime.js';

const router = Router();
router.use(requireAuth);

router.patch('/:id', (req, res) => {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!message) return res.status(404).json({ message: 'Сообщение не найдено' });
  if (message.sender_id !== req.user.id) {
    return res.status(403).json({ message: 'Редактировать можно только свои сообщения' });
  }
  if (message.deleted) return res.status(400).json({ message: 'Сообщение удалено' });

  const text = String(req.body?.text || '').trim();
  if (!text || text.length > 4000) {
    return res.status(400).json({ message: 'Сообщение должно содержать от 1 до 4000 символов' });
  }

  const editedAt = Date.now();
  db.prepare('UPDATE messages SET text = ?, edited_at = ? WHERE id = ?').run(
    text,
    editedAt,
    message.id
  );
  const updated = decorateMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(message.id));
  emitToChat(message.chat_id, { type: 'message:edited', message: updated });
  return res.json({ message: updated });
});

router.delete('/:id', (req, res) => {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!message) return res.status(404).json({ message: 'Сообщение не найдено' });
  if (message.sender_id !== req.user.id) {
    return res.status(403).json({ message: 'Удалять можно только свои сообщения' });
  }

  db.prepare('UPDATE messages SET deleted = 1, text = \'\' WHERE id = ?').run(message.id);
  emitToChat(message.chat_id, {
    type: 'message:deleted',
    id: message.id,
    chatId: message.chat_id,
    deletedAt: Date.now()
  });
  return res.json({ ok: true });
});

export default router;
