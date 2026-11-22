import { initials, displayName } from '../lib/format.js';

function hueFor(value = '') {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 360;
  return hash;
}

export default function Avatar({ user, size = 44, online = false, onClick, className = '' }) {
  const name = displayName(user);
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(11, Math.round(size * 0.34)),
    '--avatar-hue': hueFor(user?.id || name)
  };

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, 'aria-label': name } : {})}
      style={style}
      className={`avatar ${onClick ? 'clickable' : ''} ${className}`}
    >
      {user?.avatar ? <img src={user.avatar} alt={name} /> : <span>{initials(name, user?.email)}</span>}
      {online && <i className="online-dot" />}
    </Tag>
  );
}
