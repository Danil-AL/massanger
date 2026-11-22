import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { isEmail, isNickname, publicUser } from '../utils.js';
import { sendVerificationCode } from '../mail.js';
import { asyncRoute } from '../middleware.js';

const router = Router();
const CODE_TTL = 15 * 60 * 1000;

const makeCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const issueToken = (userId) => jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '30d' });

router.post(
  '/register',
  asyncRoute(async (req, res) => {
    const { email, password, nickname, hideEmail } = req.body || {};
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password || '');
    const cleanNickname = nickname == null || nickname === '' ? null : String(nickname).trim();

    if (!isEmail(cleanEmail)) return res.status(400).json({ message: 'Введите корректный email' });
    if (cleanPassword.length < 6) {
      return res.status(400).json({ message: 'Пароль должен содержать минимум 6 символов' });
    }
    if (cleanNickname && !isNickname(cleanNickname)) {
      return res.status(400).json({ message: 'Ник: от 3 до 20 букв, цифр и символа _' });
    }
    if (cleanNickname && db.prepare('SELECT 1 FROM users WHERE nickname = ? COLLATE NOCASE').get(cleanNickname)) {
      return res.status(409).json({ code: 'NICKNAME_TAKEN', message: 'Этот ник уже занят' });
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(cleanEmail)) {
      return res.status(409).json({ code: 'EMAIL_TAKEN', message: 'Этот email уже зарегистрирован' });
    }
    if (hideEmail && !cleanNickname) {
      return res.status(400).json({ message: 'Чтобы скрыть email, задайте nickname' });
    }

    const code = makeCode();
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    try {
      db.transaction(() => {
        db.prepare('DELETE FROM verification_codes WHERE email = ?').run(cleanEmail);
        db.prepare(`
          INSERT INTO users (id, email, password_hash, nickname, hide_email, avatar, verified, created_at)
          VALUES (?, ?, ?, ?, ?, NULL, 0, ?)
        `).run(userId, cleanEmail, passwordHash, cleanNickname, hideEmail ? 1 : 0, Date.now());
        db.prepare(`
          INSERT INTO verification_codes (email, code, expires_at, attempts) VALUES (?, ?, ?, 0)
        `).run(cleanEmail, code, Date.now() + CODE_TTL);
      })();
    } catch (error) {
      if (String(error.code).startsWith('SQLITE_CONSTRAINT')) {
        return res.status(409).json({ message: 'Этот email или ник уже занят' });
      }
      throw error;
    }

    const mailSent = await sendVerificationCode(cleanEmail, code);
    return res.status(201).json({
      message: 'Проверьте почту: мы отправили код подтверждения',
      email: cleanEmail,
      mailSent,
      devCode: mailSent ? undefined : code
    });
  })
);

router.post(
  '/verify',
  asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const record = db.prepare('SELECT * FROM verification_codes WHERE email = ?').get(email);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!record || !user || user.verified) {
      return res.status(400).json({ message: 'Код не найден. Запросите новый' });
    }
    if (record.expires_at < Date.now()) {
      db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);
      return res.status(400).json({ message: 'Срок действия кода истёк. Запросите новый' });
    }
    if (record.attempts >= 5) {
      return res.status(429).json({ message: 'Слишком много попыток. Запросите новый код' });
    }
    if (record.code !== code) {
      db.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE email = ?').run(email);
      return res.status(400).json({ message: 'Неверный код', attemptsLeft: 4 - record.attempts });
    }

    db.transaction(() => {
      db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(user.id);
      db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);
    })();

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    return res.json({ token: issueToken(user.id), user: publicUser(updated, { own: true }) });
  })
);

router.post(
  '/resend-code',
  asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || user.verified) return res.status(400).json({ message: 'Неизвестный email' });

    const existing = db.prepare('SELECT expires_at FROM verification_codes WHERE email = ?').get(email);
    if (existing && existing.expires_at - Date.now() > CODE_TTL - 60_000) {
      return res.status(429).json({ message: 'Подождите минуту перед повторной отправкой' });
    }

    const code = makeCode();
    db.prepare(`
      INSERT INTO verification_codes (email, code, expires_at, attempts) VALUES (?, ?, ?, 0)
      ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, attempts = 0
    `).run(email, code, Date.now() + CODE_TTL);

    const mailSent = await sendVerificationCode(email, code);
    return res.json({ email, mailSent, devCode: mailSent ? undefined : code });
  })
);

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }
    if (!user.verified) {
      return res.status(403).json({
        code: 'UNVERIFIED',
        email: user.email,
        message: 'Сначала подтвердите регистрацию'
      });
    }

    return res.json({ token: issueToken(user.id), user: publicUser(user, { own: true }) });
  })
);

export default router;
