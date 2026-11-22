import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { config } from './config.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Необходимо войти в систему' });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) throw new Error('User not found');
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Сессия истекла, войдите снова' });
  }
}

export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
