import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { attachRealtime } from './realtime.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import contactRoutes from './routes/contacts.js';
import chatRoutes from './routes/chats.js';
import messageRoutes from './routes/messages.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

app.use('/api', (_req, res) => res.status(404).json({ message: 'Маршрут не найден' }));

const distDir = path.resolve(dirname, '../../client/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((error, _req, res, _next) => {
  console.error('[ERROR]', error);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

const server = http.createServer(app);
attachRealtime(server);

server.listen(config.port, () => {
  console.log(`\n  Pulse server is running on http://localhost:${config.port}`);
  console.log(`  WebSocket endpoint: ws://localhost:${config.port}/ws\n`);
});
