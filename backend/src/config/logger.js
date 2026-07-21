import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Базовый pino-логгер: структурированные JSON-логи с уровнями и timestamp.
 * В development выводится в человекочитаемом виде через pino-pretty.
 */
export const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  transport: isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
});

const normalize = (level) => (msgOrObj, ...args) => {
  if (args.length === 0) {
    pinoLogger[level](msgOrObj);
    return;
  }

  // Частый паттерн в кодовой базе: console.error('Что-то error:', error).
  // Сохраняем эту сигнатуру вызова, но пишем структурировано через pino:
  // Error-объект уходит в поле `err`, остальное — в текстовое сообщение.
  const last = args[args.length - 1];
  const rest = args.slice(0, -1);
  const message = [msgOrObj, ...rest].filter(Boolean).join(' ');

  if (last instanceof Error) {
    pinoLogger[level]({ err: last }, message);
  } else if (last && typeof last === 'object') {
    pinoLogger[level]({ ...last }, message);
  } else {
    pinoLogger[level]([msgOrObj, ...args].filter(Boolean).join(' '));
  }
};

/**
 * Логгер с сигнатурой, совместимой с console.log/error/warn — минимальные изменения
 * в местах вызова, но вывод теперь структурированный (уровни, timestamp, request-id
 * через pino-http child logger в req.log).
 */
const logger = {
  info: normalize('info'),
  warn: normalize('warn'),
  error: normalize('error'),
  debug: normalize('debug'),
};

export default logger;
