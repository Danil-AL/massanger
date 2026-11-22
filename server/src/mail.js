import nodemailer from 'nodemailer';
import { config, smtpConfigured } from './config.js';

let transporter = null;

if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });
}

export async function sendVerificationCode(email, code) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f7f7fb;border-radius:20px">
      <h1 style="color:#5b4bdb;margin:0 0 8px;font-size:24px">Pulse</h1>
      <p style="color:#333;font-size:16px">Подтвердите регистрацию — введите этот код в приложении:</p>
      <div style="background:#fff;border-radius:14px;padding:18px;text-align:center;font-size:34px;letter-spacing:10px;font-weight:700;color:#5b4bdb">${code}</div>
      <p style="color:#888;font-size:13px">Код действует 15 минут. Если это были не вы — просто проигнорируйте письмо.</p>
    </div>
  `;

  if (!transporter) {
    console.log(`\n[DEV MAIL] Код подтверждения для ${email}: ${code}\n`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to: email,
      subject: 'Pulse — подтверждение регистрации',
      text: `Ваш код подтверждения: ${code}. Код действует 15 минут.`,
      html
    });
    console.log(`[MAIL] Verification code sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[MAIL] Failed to send verification email:', error.message);
    return false;
  }
}
