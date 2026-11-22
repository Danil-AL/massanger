import { useRef, useState } from 'react';
import { Camera, Check, Mail, ShieldCheck, AtSign, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';

function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Не удалось открыть изображение'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const side = Math.min(image.width, image.height);
        canvas
          .getContext('2d')
          .drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfileModal({ user, onSaved, onClose }) {
  const fileRef = useRef(null);
  const [nickname, setNickname] = useState(user.nickname || '');
  const [hideEmail, setHideEmail] = useState(user.hideEmail);
  const [avatar, setAvatar] = useState(user.avatar || null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Выберите изображение');
    if (file.size > 8 * 1024 * 1024) return setError('Файл слишком большой (максимум 8 МБ)');
    try {
      setAvatar(await resizeAvatar(file));
      setAvatarChanged(true);
      setError('');
    } catch (err) {
      setError(err.message);
    }
    event.target.value = '';
  }

  async function handleSave() {
    const cleanNickname = nickname.trim();
    if (cleanNickname && !/^[\p{L}\p{N}_]{3,20}$/u.test(cleanNickname)) {
      return setError('Ник: от 3 до 20 букв, цифр и символа _');
    }
    if (hideEmail && !cleanNickname) {
      return setError('Чтобы скрыть email, задайте nickname');
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.patch('/users/me', {
        nickname: cleanNickname || null,
        hideEmail,
        ...(avatarChanged ? { avatar } : {})
      });
      onSaved(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const footer = (
    <>
      <button type="button" className="ghost-button" onClick={onClose}>Отмена</button>
      <button type="button" className="primary-button" onClick={handleSave} disabled={loading}>
        {loading ? 'Сохраняем…' : 'Сохранить изменения'}
      </button>
    </>
  );

  return (
    <Modal title="Настройки профиля" subtitle="Как вас видят другие пользователи" onClose={onClose} footer={footer}>
      <div className="profile-avatar-row">
        <div className="avatar-editor">
          <Avatar user={{ ...user, avatar }} size={92} />
          <button type="button" className="avatar-camera" onClick={() => fileRef.current?.click()} aria-label="Загрузить аватар"><Camera size={16} /></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>
        <div>
          <strong>{user.nickname || 'Без ника'}</strong>
          <p className="muted">{user.email}</p>
          {avatar && (
            <button type="button" className="text-button" onClick={() => { setAvatar(null); setAvatarChanged(true); }}>
              <Trash2 size={13} /> Удалить аватар
            </button>
          )}
        </div>
      </div>

      <label className="field">
        <span><AtSign size={14} /> Никнейм</span>
        <div className="field-control"><input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Уникальное имя в системе" maxLength={20} /></div>
        <small className="field-hint">Уникален для всех пользователей. Без ника email виден в поиске.</small>
      </label>

      <div className="toggle-row">
        <div className="toggle-icon"><ShieldCheck size={19} /></div>
        <div className="toggle-copy">
          <strong>Скрыть email</strong>
          <small>Ваш email не будет находиться поиском и не покажется другим пользователям</small>
        </div>
        <button
          type="button"
          className={`switch ${hideEmail ? 'on' : ''}`}
          onClick={() => setHideEmail((value) => !value)}
          aria-label="Скрыть email"
        ><span>{hideEmail && <Check size={12} />}</span></button>
      </div>

      <div className="profile-email-note"><Mail size={15} /> <span>Email используется только для входа: <strong>{user.email}</strong></span></div>

      {error && <div className="alert alert-error">{error}</div>}
    </Modal>
  );
}
