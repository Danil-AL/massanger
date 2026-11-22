import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';

const sockets = new Map(); // userId -> Set<WebSocket>

export function emitToUser(userId, payload) {
  const userSockets = sockets.get(userId);
  if (!userSockets) return;
  const message = JSON.stringify(payload);
  for (const socket of userSockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(message);
  }
}

export function emitToChat(chatId, payload) {
  const members = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId);
  for (const member of members) emitToUser(member.user_id, payload);
}

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const userSockets of sockets.values()) {
    for (const socket of userSockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }
}

function isMember(chatId, userId) {
  return Boolean(
    db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, userId)
  );
}

export function attachRealtime(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    let url;
    try {
      url = new URL(request.url || '/', 'http://localhost');
    } catch {
      return socket.destroy();
    }
    if (url.pathname !== '/ws') return socket.destroy();

    let payload;
    try {
      payload = jwt.verify(url.searchParams.get('token') || '', config.jwtSecret);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.userId = payload.sub;
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    const userId = ws.userId;
    if (!sockets.has(userId)) sockets.set(userId, new Set());
    sockets.get(userId).add(ws);
    ws.isAlive = true;

    ws.send(JSON.stringify({ type: 'hello', onlineUsers: [...sockets.keys()] }));
    broadcast({ type: 'presence', userId, online: true });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (data.type === 'typing' && typeof data.chatId === 'string') {
        if (!isMember(data.chatId, userId)) return;
        const members = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(data.chatId);
        for (const member of members) {
          if (member.user_id === userId) continue;
          emitToUser(member.user_id, {
            type: 'typing',
            chatId: data.chatId,
            userId,
            isTyping: Boolean(data.isTyping)
          });
        }
        return;
      }

      if (data.type === 'read' && typeof data.chatId === 'string') {
        if (!isMember(data.chatId, userId)) return;
        const now = Date.now();
        db.prepare('UPDATE chat_members SET last_read_at = ? WHERE chat_id = ? AND user_id = ?').run(
          now,
          data.chatId,
          userId
        );
        emitToChat(data.chatId, { type: 'chat:read', chatId: data.chatId, userId, lastReadAt: now });
      }
    });

    ws.on('close', () => {
      const userSockets = sockets.get(userId);
      if (!userSockets) return;
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        sockets.delete(userId);
        broadcast({ type: 'presence', userId, online: false });
      }
    });
  });

  const heartbeat = setInterval(() => {
    for (const wssClient of wss.clients) {
      if (wssClient.isAlive === false) {
        wssClient.terminate();
        continue;
      }
      wssClient.isAlive = false;
      wssClient.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));
  return wss;
}
