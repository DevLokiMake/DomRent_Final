import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Подписывает JWT с уникальным jti — нужен, чтобы конкретный токен можно было
 * отозвать по logout (см. RevokedToken + middlewares/auth.js), не дожидаясь его
 * естественного истечения.
 */
export const signAuthToken = (payload, options) => {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, process.env.JWT_SECRET, options);
};

export default signAuthToken;
