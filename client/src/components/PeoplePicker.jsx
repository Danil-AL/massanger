import { useEffect, useState } from 'react';
import { Check, Search, UserPlus, Users } from 'lucide-react';
import { api } from '../api.js';
import { displayName } from '../lib/format.js';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';

export default function PeoplePicker({
  mode = 'single',
  title = 'Выберите пользователя',
  subtitle,
  contacts,
  excludeIds = [],
  online = new Set(),
  confirmLabel = 'Добавить',
  onConfirm,
  onContactAdded,
  onClose
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.get(`/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data.users);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const allowedContacts = contacts.filter((contact) => !excludeIds.includes(contact.id));
  const matchesQuery = (user) => {
    const needle = query.trim().toLowerCase();
    return !needle || displayName(user).toLowerCase().includes(needle) || (user.email || '').toLowerCase().includes(needle);
  };
  const visibleContacts = allowedContacts.filter(matchesQuery);
  const extraResults = results.filter(
    (user) => !allowedContacts.some((contact) => contact.id === user.id) && !excludeIds.includes(user.id)
  );

  function toggle(id) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function addContact(user) {
    try {
      await api.post('/contacts', { userId: user.id });
      onContactAdded?.(user);
      setError('');
      if (mode === 'multi') toggle(user.id);
      else onConfirm(user);
    } catch (err) {
      setError(err.message);
    }
  }

  function choose(user) {
    if (mode === 'multi') toggle(user.id);
    else onConfirm(user);
  }

  const footer =
    mode === 'multi' ? (
      <>
        <span className="muted">Выбрано: {selected.length}</span>
        <button type="button" className="primary-button" disabled={!selected.length} onClick={() => onConfirm(selected)}>
          {confirmLabel}
        </button>
      </>
    ) : null;

  const row = (user, isContact = true) => (
    <button
      key={user.id}
      type="button"
      className={`people-row ${mode === 'multi' && selected.includes(user.id) ? 'selected' : ''}`}
      onClick={() => (isContact ? choose(user) : addContact(user))}
    >
      <Avatar user={user} size={40} online={online.has(user.id)} />
      <span className="people-info">
        <strong>{displayName(user)}</strong>
        <small>{user.email || 'Email скрыт'}</small>
      </span>
      {mode === 'multi' ? (
        <span className={`check-circle ${selected.includes(user.id) ? 'checked' : ''}`}><Check size={14} /></span>
      ) : isContact ? (
        <span className="row-action">Написать</span>
      ) : (
        <span className="row-action add"><UserPlus size={14} /> Добавить</span>
      )}
    </button>
  );

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} footer={footer}>
      <div className="search-field compact">
        <Search size={17} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Имя, ник или email" autoFocus />
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {visibleContacts.length > 0 && (
        <>
          <div className="picker-section-title"><Users size={14} /> Контакты</div>
          <div className="people-list">{visibleContacts.map((user) => row(user))}</div>
        </>
      )}

      {extraResults.length > 0 && (
        <>
          <div className="picker-section-title">Поиск по системе</div>
          <div className="people-list">{extraResults.map((user) => row(user, user.isContact))}</div>
        </>
      )}

      {query.trim().length >= 2 && loading && <div className="picker-empty">Ищем…</div>}
      {!visibleContacts.length && !extraResults.length && !loading && (
        <div className="picker-empty">
          {query.trim().length >= 2 ? 'Никого не нашли' : 'У вас пока нет контактов — найдите людей через поиск'}
        </div>
      )}
    </Modal>
  );
}
