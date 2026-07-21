import crypto from 'crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';

/**
 * bot_sessions.access_token хранит боевой JWT DomRent — при компрометации бота/БД
 * это давало бы прямой доступ к аккаунту пользователя. Шифруем at rest (AES-256-GCM).
 * Ключ — 32-байтный: либо hex-строка ровно 64 символа, либо произвольный секрет,
 * из которого выводим ключ через sha256 (удобно для простых значений в .env).
 */
const getKey = () => {
  const raw = config.SESSION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('SESSION_ENCRYPTION_KEY не задан — обязателен для шифрования сессий бота');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
};

export const encrypt = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (payload) => {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Некорректный формат зашифрованного значения');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
};

/** true, если значение похоже на наш формат iv:authTag:ciphertext (все части — hex) */
export const looksEncrypted = (value) =>
  typeof value === 'string' && /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(value);
