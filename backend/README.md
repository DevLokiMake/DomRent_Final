# DomRent Backend

Backend API для платформы DomRent — системы поиска и бронирования недвижимости.

## Установка

1. Установите зависимости:
   ```bash
   npm install
   ```

2. Настройте базу данных PostgreSQL и обновите `.env` файл.

3. Запустите миграции Prisma:
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

4. Запустите сервер:
   ```bash
   npm start
   ```

## Структура проекта

- `server.js` — точка входа
- `src/controllers/` — контроллеры
- `src/routes/` — маршруты
- `src/middlewares/` — middleware
- `src/services/` — бизнес-логика (если нужно)
- `prisma/schema.prisma` — схема базы данных

## API Endpoints

Интерактивная документация (OpenAPI/Swagger): `/api-docs` (спецификация — `openapi.yaml`, держите её в синхроне с роутами).

См. также `API_EXAMPLES.md` для примеров запросов.

## Переменные окружения

- `DATABASE_URL` — URL базы данных PostgreSQL
- `JWT_SECRET` — секретный ключ для JWT
- `PORT` — порт сервера (по умолчанию 3000)
- `TELEGRAM_BOT_TOKEN` — токен Telegram бота
- `TELEGRAM_CHAT_ID` — ID чата для уведомлений