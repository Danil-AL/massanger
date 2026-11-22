import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { publicUser } from '../utils.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db
    .prepare(`
      SELECT u.* FROM contacts c
      JOIN users u ON u.id = c.contact_id
      WHERE c.user_id = ?
      ORDER BY u.nickname IS NULL, u.nickname COLLATE NOCASE ASC, u.email ASC
    `)
    .all(req.user.id);
  res.json({ contacts: rows.map((row) => publicUser(row)) });
});

router.post('/', (req, res) => {
  const raw = String(req.body?.userId || req.body?.identifier || '').trim();
  if (!raw) return res.status(400).json({ message: 'Укажите пользователя' });

  let user = db.prepare('SELECT * FROM users WHERE id = ? AND verified = 1').get(raw);
  if (!user) {
    user = db
      .prepare(`SELECT * FROM users WHERE verified = 1 AND (nickname = ? COLLATE NOCASE OR (hide_email = 0 AND email = ? COLLATE NOCASE))`)
      .get(raw, raw.toLowerCase());
  }
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  if (user.id === req.user.id) return res.status(400).json({ message: 'Нельзя добавить себя' });
  if (db.prepare('SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?').get(req.user.id, user.id)) {
    return res.status(409).json({ message: 'Этот пользователь уже в контактах' });
  }

  db.prepare('INSERT INTO contacts (user_id, contact_id, created_at) VALUES (?, ?, ?)').run(
    req.user.id,
    user.id,
    Date.now()
  );
  return res.status(201).json({ contact: publicUser(user) });
});

router.delete('/:userId', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?').run(req.user.id, req.params.userId);
  return res.json({ ok: true });
});

export default router;
