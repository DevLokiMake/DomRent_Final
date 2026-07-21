import dotenv from 'dotenv';
dotenv.config();

export const config = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  API_URL: process.env.DOMRENT_API_URL || 'http://localhost:5000/api',
  BOT_API_KEY: process.env.BOT_API_KEY || 'secret',
  PORT: parseInt(process.env.BOT_PORT || '4000'),
  DB_URL: process.env.DATABASE_URL,
  SESSION_ENCRYPTION_KEY: process.env.SESSION_ENCRYPTION_KEY,
  ADMIN_IDS: (process.env.ADMIN_CHAT_IDS || '')
    .split(',')
    .map(id => parseInt(id.trim()))
    .filter(n => !isNaN(n) && n > 0),
};
