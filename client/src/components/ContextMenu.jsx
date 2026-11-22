import { useEffect } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  useEffect(() => {
    const close = () => onClose();
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(x, window.innerWidth - 220));
  const top = Math.max(8, Math.min(y, window.innerHeight - items.length * 44 - 20));

  return (
    <div className="context-menu" style={{ left, top }} onMouseDown={(event) => event.stopPropagation()}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={item.danger ? 'danger' : ''}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
