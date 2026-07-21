# DomRent Mobile

Мобильное приложение DomRent на Expo (React Native + expo-router).

## Запуск

```bash
npm install
npx expo start
```

Откройте в [development build](https://docs.expo.dev/develop/development-builds/introduction/), Android/iOS эмуляторе или [Expo Go](https://expo.dev/go).

### ⚠️ Настройка API endpoint (важно для iOS/реального устройства)

По умолчанию (`api/axios.ts`, `getBaseURL()`):
- **Android эмулятор** — `http://10.0.2.2:5000/api` работает из коробки.
- **iOS эмулятор / реальное устройство** — `http://localhost:5000/api` **не работает**, нужно указать IP компьютера в локальной сети.

Как исправить:
1. Узнайте IP компьютера: `ipconfig` (Windows) / `ifconfig` или `ip addr` (Mac/Linux).
2. В `api/axios.ts` замените `localhost` на этот IP для iOS-ветки `getBaseURL()`.
3. Компьютер и устройство должны быть в одной Wi-Fi сети, порт 5000 не должен блокироваться файрволом.
4. Пересоберите приложение (`npm run ios` / `npm run android`).

Если после этого всё равно `Network Error` — проверьте, что бэкенд (`backend/`) запущен и IP указан верно.

## Авторизация

`context/AuthContext.tsx` управляет состоянием авторизации:
- **SecureStore** — хранит JWT (`authToken`).
- **AsyncStorage** — кэширует данные пользователя для быстрого старта.
- **Axios interceptors** (`api/axios.ts`) — автоматически добавляют `Authorization: Bearer <token>` к каждому запросу; при 401 токен и данные пользователя должны сбрасываться и пользователь — перенаправляться на `/login`.

Основные методы контекста: `login`, `signup`, `logout`, `restoreSession`, а также состояния `user`, `token`, `isLoading`, `isAuthenticated`.

Регистрация (`signup`) теперь требует подтверждения email перед входом — бэкенд не выдаёт токен сразу, а отправляет письмо со ссылкой подтверждения. `signup()` возвращает `{ requiresVerification: boolean }`; см. `app/register.tsx` для примера обработки.

## Архитектура экрана объекта (`app/property/[id].tsx`)

Логика и UI разделены:

```
app/property/[id].tsx          — экран-оркестратор (вызывает хук, передаёт props компонентам)
hooks/usePropertyDetails.ts    — вся бизнес-логика: запросы к API, состояние, расчёты, обработчики
components/property/
  ├── PropertyImageCarousel.tsx  — карусель изображений
  ├── PropertyHeader.tsx         — название, цена, город/тип, избранное
  ├── PropertyOwnerInfo.tsx      — описание + карточка владельца
  └── BookingForm.tsx            — выбор дат, расчёт стоимости, кнопка бронирования
```

Этот паттерн (хук с бизнес-логикой + чистые UI-компоненты + тонкий экран-обёртка) стоит переиспользовать при рефакторинге других крупных экранов.

## Экран поиска (`app/(tabs)/explore.tsx`)

Список объектов через `FlatList` (виртуализация) с модальным окном фильтров (город, тип жилья, диапазон цен). Запрос: `GET /properties?city=...&type=...&minPrice=...&maxPrice=...`. Состояния: загрузка / успех / ошибка с повтором / пусто.

Ручной чек-лист тестирования этого экрана (загрузка, карточки, фильтры, пустое состояние, ошибки сети, производительность FlatList на 100+ элементах) — см. в истории репозитория при необходимости; автотестов для мобильного приложения пока нет (см. корневой обзор проекта).

## Структура

```
app/            — экраны (expo-router, file-based routing)
components/     — переиспользуемые UI-компоненты
context/        — AuthContext и др.
hooks/          — бизнес-логика экранов
api/            — axios-клиент
types/          — общие TypeScript-типы
```
