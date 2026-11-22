import { useState } from 'react';
import { AtSign, BellRing, Check, Eye, EyeOff, Lock, Mail, MessageCircleMore, Send, Sparkles, Users } from 'lucide-react';
import { api } from '../api.js';
import { unlockAudio } from '../lib/sound.js';

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [hideEmail, setHideEmail] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [mailSent, setMailSent] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setCode('');
  };

  async function handleSubmit(event) {
    event.preventDefault();
    unlockAudio();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const data = await api.login({ email, password });
        onAuthenticated(data);
      } else if (mode === 'register') {
        const data = await api.register({ email, password, nickname: nickname || null, hideEmail });
        setDevCode(data.devCode || null);
        setMailSent(data.mailSent);
        setMode('verify');
      } else {
        const data = await api.verify({ email, code });
        onAuthenticated(data);
      }
    } catch (err) {
      if (err.code === 'UNVERIFIED') {
        setEmail(err.data?.email || email);
        setMode('verify');
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setLoading(true);
    try {
      const data = await api.resendCode({ email });
      setDevCode(data.devCode || null);
      setMailSent(data.mailSent);
      setError('Новый код отправлен');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />

      <div className="auth-layout">
        <section className="auth-art">
          <div className="brand brand-light">
            <div className="brand-mark"><MessageCircleMore size={24} strokeWidth={2.4} /></div>
            <span>Pulse</span>
          </div>

          <div className="art-copy">
            <div className="art-pill"><Sparkles size={14} /> Общение без задержек</div>
            <h1>Будьте на связи<br />в любую минуту</h1>
            <p>Личные и групповые чаты, мгновенная доставка сообщений и всё, что нужно для живого диалога.</p>
          </div>

          <div className="art-mock" aria-hidden="true">
            <div className="mock-bubble mock-bubble-in">
              <div className="mock-avatar">А</div>
              <div><div className="mock-line wide" /><div className="mock-line" /></div>
              <span className="mock-time">12:41</span>
            </div>
            <div className="mock-bubble mock-bubble-out">
              <div className="mock-line wide" /><div className="mock-line short" />
              <span className="mock-time">12:42</span>
            </div>
            <div className="mock-bubble mock-bubble-in mock-typing">
              <div className="mock-avatar">М</div>
              <div className="typing-dots"><i /><i /><i /></div>
            </div>
          </div>

          <div className="art-features">
            <span><Send size={15} /> WebSocket</span>
            <span><Users size={15} /> Группы</span>
            <span><BellRing size={15} /> Уведомления</span>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            {mode !== 'verify' ? (
              <>
                <div className="auth-heading">
                  <h2>{mode === 'login' ? 'С возвращением!' : 'Создать аккаунт'}</h2>
                  <p>{mode === 'login' ? 'Войдите, чтобы продолжить общение' : 'Пара минут — и вы в деле'}</p>
                </div>

                <div className="auth-tabs">
                  <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Вход</button>
                  <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Регистрация</button>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                  <label className="field">
                    <span>Email</span>
                    <div className="field-control"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></div>
                  </label>

                  {mode === 'register' && (
                    <label className="field">
                      <span>Ник <em>необязательно</em></span>
                      <div className="field-control"><AtSign size={17} /><input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="neon_kid" minLength={3} maxLength={20} /></div>
                    </label>
                  )}

                  <label className="field">
                    <span>Пароль</span>
                    <div className="field-control">
                      <Lock size={17} />
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" minLength={6} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                      <button type="button" className="icon-button tiny" onClick={() => setShowPassword((v) => !v)} aria-label="Показать пароль">
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>

                  {mode === 'register' && (
                    <label className="checkbox-line">
                      <input type="checkbox" checked={hideEmail} onChange={(e) => setHideEmail(e.target.checked)} />
                      <span className="checkbox-box"><Check size={12} /></span>
                      <span>Скрыть email в поиске <em>(нужен ник)</em></span>
                    </label>
                  )}

                  {error && <div className="alert alert-error">{error}</div>}

                  <button className="primary-button full" type="submit" disabled={loading}>
                    {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                  </button>
                </form>
              </>
            ) : (
              <div className="verify-view">
                <div className="verify-icon"><Mail size={30} /></div>
                <div className="auth-heading">
                  <h2>Подтвердите email</h2>
                  <p>Мы отправили 6-значный код на <strong>{email}</strong></p>
                </div>

                {devCode && (
                  <div className="dev-code">
                    <span>Демо-режим: код подтверждения</span>
                    <strong>{devCode}</strong>
                    <small>{mailSent ? 'Письмо также отправлено на почту' : 'SMTP не настроен — используйте этот код'}</small>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                  <label className="field">
                    <span>Код подтверждения</span>
                    <div className="field-control code-input"><Lock size={17} /><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" autoFocus required /></div>
                  </label>
                  {error && <div className={`alert ${error.includes('отправлен') ? 'alert-success' : 'alert-error'}`}>{error}</div>}
                  <button className="primary-button full" type="submit" disabled={loading || code.length !== 6}>
                    {loading ? 'Проверяем…' : 'Подтвердить'}
                  </button>
                </form>

                <div className="verify-actions">
                  <button type="button" className="text-button" onClick={handleResend} disabled={loading}>Отправить код ещё раз</button>
                  <button type="button" className="text-button" onClick={() => switchMode('login')}>Вернуться ко входу</button>
                </div>
              </div>
            )}
          </div>
          <p className="auth-footer">Pulse Messenger · асинхронное общение в реальном времени</p>
        </section>
      </div>
    </div>
  );
}
