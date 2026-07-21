import { pool } from '../db.js';
import { encrypt, decrypt, looksEncrypted } from '../utils/crypto.js';

// ── Sessions ────────────────────────────────────────────────────────────────

export const getSession = async (telegramId) => {
  const { rows } = await pool.query(
    'SELECT * FROM bot_sessions WHERE telegram_id = $1',
    [telegramId]
  );
  const session = rows[0];
  if (!session) return null;

  if (session.access_token && looksEncrypted(session.access_token)) {
    session.access_token = decrypt(session.access_token);
  }
  // Иначе — запись из старой версии (до включения шифрования), токен ещё в открытом виде.
  // Будет перешифрован при следующем saveSession (повторный /start или обновление токена).

  return session;
};

export const saveSession = async ({ telegramId, userId, accessToken, firstName, username, role }) => {
  const encryptedToken = encrypt(accessToken);
  await pool.query(`
    INSERT INTO bot_sessions (telegram_id, user_id, access_token, first_name, username, role, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (telegram_id) DO UPDATE
      SET user_id = $2, access_token = $3, first_name = $4, username = $5, role = $6, updated_at = NOW()
  `, [telegramId, userId, encryptedToken, firstName, username, role || 'USER']);
};

export const deleteSession = async (telegramId) => {
  await pool.query('DELETE FROM bot_sessions WHERE telegram_id = $1', [telegramId]);
};

export const getAllSessionIds = async () => {
  const { rows } = await pool.query('SELECT telegram_id FROM bot_sessions');
  return rows.map(r => r.telegram_id);
};

// ── Support tickets ─────────────────────────────────────────────────────────

export const createTicket = async ({ telegramId, userId, tgUsername, tgFirstName, message }) => {
  const { rows } = await pool.query(`
    INSERT INTO bot_support_tickets (telegram_id, user_id, tg_username, tg_first_name, message)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [telegramId, userId || null, tgUsername || null, tgFirstName || null, message]);
  return rows[0];
};

export const getOpenTickets = async () => {
  const { rows } = await pool.query(`
    SELECT * FROM bot_support_tickets
    WHERE status = 'open'
    ORDER BY created_at ASC
    LIMIT 25
  `);
  return rows;
};

export const getTicketById = async (id) => {
  const { rows } = await pool.query(
    'SELECT * FROM bot_support_tickets WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

export const replyTicket = async (id, reply, adminTelegramId) => {
  const { rows } = await pool.query(`
    UPDATE bot_support_tickets
    SET reply = $1, status = 'answered', admin_telegram_id = $2, updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `, [reply, adminTelegramId, id]);
  return rows[0];
};

export const closeTicket = async (id) => {
  await pool.query(
    'UPDATE bot_support_tickets SET status = $1, updated_at = NOW() WHERE id = $2',
    ['closed', id]
  );
};
