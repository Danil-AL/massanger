const pad = (value) => String(value).padStart(2, '0');

export function formatTime(timestamp) {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatChatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  if (isSameDay(date, now)) return formatTime(timestamp);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Вчера';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
}

export function formatDay(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  if (isSameDay(date, now)) return 'Сегодня';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function initials(name, email) {
  const source = (name || email || '?').trim();
  const parts = source.split(/[\s_@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function displayName(user) {
  return user?.nickname || user?.email || 'Пользователь';
}

export function messagePreview(message) {
  if (!message) return 'Начните разговор';
  if (message.deleted) return 'Сообщение удалено';
  if (!message.text && message.forwardedFrom) return `↪ ${message.forwardedFrom.text}`;
  return message.text.length > 48 ? `${message.text.slice(0, 48)}…` : message.text;
}
