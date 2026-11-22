// End-to-end smoke test for the Pulse API: node scripts/smoke-test.mjs
import WebSocket from 'ws';

const BASE = 'http://localhost:3001/api';
const suffix = Date.now();

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function registerAndVerify(email, nickname, hideEmail = false) {
  const registered = await request('/auth/register', {
    method: 'POST',
    body: { email, password: 'secret123', nickname, hideEmail }
  });
  const code = registered.devCode;
  assert(code, `No verification code for ${email}. Configure SMTP or check dev fallback.`);
  const verified = await request('/auth/verify', { method: 'POST', body: { email, code } });
  return verified.token;
}

const tokenA = await registerAndVerify(`alice${suffix}@example.com`, `alice_${suffix}`, true);
const tokenB = await registerAndVerify(`bob${suffix}@example.com`, `bob_${suffix}`);

const meA = (await request('/users/me', { token: tokenA })).user;
const meB = (await request('/users/me', { token: tokenB })).user;
assert(meA.email && meA.hideEmail, 'A should see own hidden email');

const hiddenSearch = await request(`/users/search?q=alice${suffix}@example.com`, { token: tokenB });
assert(hiddenSearch.users.length === 0, 'Hidden email must not be searchable');
const nickSearch = await request(`/users/search?q=bob_${suffix}`, { token: tokenA });
assert(nickSearch.users.some((user) => user.id === meB.id), 'Nickname search should find B');

await request('/contacts', { method: 'POST', token: tokenA, body: { userId: meB.id } });
const contacts = (await request('/contacts', { token: tokenA })).contacts;
assert(contacts.length === 1, 'Contact should be added');

const direct = await request('/chats/direct', { method: 'POST', token: tokenA, body: { userId: meB.id } });
assert(direct.chat.type === 'direct', 'Direct chat created');

let socketReady;
let socketMessage;
const readyPromise = new Promise((resolve) => { socketReady = resolve; });
const messagePromise = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('WebSocket message timeout')), 4000);
  socketMessage = (message) => { clearTimeout(timer); resolve(message); };
});
const socket = new WebSocket(`ws://localhost:3001/ws?token=${tokenB}`);
socket.on('message', (raw) => {
  const event = JSON.parse(raw.toString());
  if (event.type === 'hello') socketReady();
  if (event.type === 'message:new') socketMessage(event.message);
});
socket.on('error', (error) => socketMessage(null, error));
await readyPromise;

const sent = await request(`/chats/${direct.chat.id}/messages`, {
  method: 'POST', token: tokenA, body: { text: 'Привет, Боб!' }
});
assert(sent.message.text === 'Привет, Боб!', 'Message created');
const received = await messagePromise;
assert(received?.id === sent.message.id, 'WebSocket delivered the message');
socket.close();

await request(`/messages/${sent.message.id}`, {
  method: 'PATCH', token: tokenA, body: { text: 'Привет, Боб! (исправлено)' }
});
await request(`/messages/${sent.message.id}`, { method: 'DELETE', token: tokenA });

const forwarded = await request(`/chats/${direct.chat.id}/messages`, {
  method: 'POST', token: tokenA,
  body: { text: '', forwardedFrom: { senderName: 'Боб', text: 'Пересылаем это', createdAt: Date.now() } }
});
assert(forwarded.message.forwardedFrom.text === 'Пересылаем это', 'Forwarded message stored');

const group = await request('/chats/group', {
  method: 'POST', token: tokenA, body: { name: 'Тестовая группа', memberIds: [meB.id] }
});
assert(group.chat.type === 'group' && group.chat.members.length === 2, 'Group created');

await request(`/chats/${group.chat.id}/mute`, { method: 'PATCH', token: tokenA, body: { muted: true } });
const chats = (await request('/chats', { token: tokenA })).chats;
const muted = chats.find((chat) => chat.id === group.chat.id);
assert(muted?.muted === true, 'Mute persisted');

const messages = (await request(`/chats/${direct.chat.id}/messages`, { token: tokenA })).messages;
assert(messages.length === 2, 'Messages listed');

console.log('\n  ✓ Smoke test passed: auth, email verification, search privacy, contacts,');
console.log('    direct/group chats, WebSocket delivery, edit/delete/forward, mute.\n');
