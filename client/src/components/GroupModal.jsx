import { useState } from 'react';
import { Check, Hash, Search } from 'lucide-react';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';
import { displayName } from '../lib/format.js';

export default function GroupModal({ contacts, online, onConfirm, onClose }) {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);

  const visible = contacts.filter((contact) => {
    const needle = query.trim().toLowerCase();
    return !needle || displayName(contact).toLowerCase().includes(needle) || (contact.email || '').toLowerCase().includes(needle);
  });

  const toggle = (id) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <Modal
      title="Новая группа"
      subtitle="Выберите контакты — в группу можно добавить только их"
      onClose={onClose}
      footer={
        <>
          <span className="muted">Участников: {selected.length + 1}</span>
          <button type="button" className="primary-button" disabled={!name.trim() || !selected.length} onClick={() => onConfirm(name.trim(), selected)}>
            Создать группу
          </button>
        </>
      }
    >
      <label className="field">
        <span>Название группы</span>
        <div className="field-control"><Hash size={16} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Путешествие" maxLength={50} autoFocus /></div>
      </label>
      <div className="search-field compact"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по контактам" /></div>
      <div className="people-list">
        {visible.map((contact) => (
          <button key={contact.id} type="button" className={`people-row ${selected.includes(contact.id) ? 'selected' : ''}`} onClick={() => toggle(contact.id)}>
            <Avatar user={contact} size={40} online={online.has(contact.id)} />
            <span className="people-info"><strong>{displayName(contact)}</strong><small>{contact.email || 'Email скрыт'}</small></span>
            <span className={`check-circle ${selected.includes(contact.id) ? 'checked' : ''}`}><Check size={14} /></span>
          </button>
        ))}
        {!visible.length && <div className="picker-empty">Контакты не найдены</div>}
      </div>
    </Modal>
  );
}
