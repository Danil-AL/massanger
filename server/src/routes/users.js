import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { isNickname, publicUser } from '../utils.js';
import { isContact } from '../utils.js';

const router = Router();
router.use(requireAuth);

const validAvatar = (value) =>
  value === null ||
  (typeof value === 'string' &&
    /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(value) &&
    value.length <= 2_000_000);

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user, { own: true }) });
});

router.patch('/me', (req, res) => {
  const body = req.body || {};
  let nickname = req.user.nickname;
  if (Object.prototype.hasOwnProperty.call(body, 'nickname')) {
    nickname = body.nickname == null || body.nickname === '' ? null : String(body.nickname).trim();
  }
  if (nickname && !isNickname(nickname)) {
    return res.status(400).json({ message: 'Ник: от 3 до 20 букв, цифр и символа _' });
  }
  if (
    nickname &&
    db.prepare('SELECT 1 FROM users WHERE nickname = ? COLLATE NOCASE AND id <> ?').get(nickname, req.user.id)
  ) {
    return res.status(409).json({ code: 'NICKNAME_TAKEN', message: 'Этот ник уже занят' });
  }

  const hideEmail = Object.prototype.hasOwnProperty.call(body, 'hideEmail')
    ? Boolean(body.hideEmail)
    : Boolean(req.user.hide_email);
  if (hideEmail && !nickname) {
    return res.status(400).json({ message: 'Чтобы скрыть email, задайте nickname' });
  }

  const avatar = Object.prototype.hasOwnProperty.call(body, 'avatar') ? body.avatar : req.user.avatar;
  if (!validAvatar(avatar)) {
    return res.status(400).json({ message: 'Некорректное изображение аватара' });
  }

  db.prepare('UPDATE users SET nickname = ?, hide_email = ?, avatar = ? WHERE id = ?').run(
    nickname,
    hideEmail ? 1 : 0,
    avatar,
    req.user.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return res.json({ user: publicUser(updated, { own: true }) });
});

router.get('/search', (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.json({ users: [] });

  const escaped = query.replace(/[\\%_]/g, '\\$&');
  const like = `%${escaped}%`;
  const rows = db
    .prepare(`
      SELECT * FROM users
      WHERE id <> ? AND verified = 1
        AND (nickname LIKE ? ESCAPE '\\' OR (hide_email = 0 AND email LIKE ? ESCAPE '\\'))
      ORDER BY nickname IS NULL, nickname COLLATE NOCASE ASC, email ASC
      LIMIT 30
    `)
    .all(req.user.id, like, like);

  return res.json({
    users: rows.map((row) => ({ ...publicUser(row), isContact: isContact(req.user.id, row.id) }))
  });
});

export default router;
