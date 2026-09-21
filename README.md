# Priority

Реализованы предметные модели, хранение и внутренние серверные операции
приоритетов и месячных планов. Главная страница пока пустая.

## Локальный запуск

Node.js 24 (см. `.nvmrc`), pnpm 11.19.0 (см. `packageManager`).

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Пустая страница работает без облачных настроек. Для Neon заполните в `.env.local`:

- `DATABASE_URL` — строка PostgreSQL-подключения из нужной ветки Neon;
- `NEON_AUTH_BASE_URL` — адрес Neon Auth этой же ветки;
- `NEON_AUTH_COOKIE_SECRET` — случайный секрет длиной минимум 32 символа
  (создать: `openssl rand -base64 32`).

Не коммитьте `.env.local`. Для разработки используйте отдельную ветку Neon.

## Основа стека

- Next.js App Router, React, TypeScript.
- `src/shared/auth/` — серверный и браузерный клиенты Neon Auth;
  `/api/auth/[...path]` — обработчик API. Формы входа и защита предметных маршрутов
  будут добавлены в первом вертикальном сценарии. Без настроек API возвращает 503.
- `src/shared/database/` — Drizzle с Neon WebSocket-драйвером;
  `withDatabase` освобождает соединения после операции и поддерживает `db.transaction`.
- `src/shared/config/env.ts` — проверка настроек через Zod при использовании сервиса.
- Radix Primitives (`radix-ui`), Lucide React; CSS Modules поддерживаются Next.js,
  общие CSS-переменные заданы в `src/shared/styles/tokens.css` и подключены
  в `app/globals.css`. Правила использования — в `src/shared/styles/README.md`.
- date-fns и `@date-fns/tz` — основа для календарных расчётов в часовом поясе пользователя.
  Проверка ключа месяца реализована; расчёты принадлежности недель ещё не добавлены.

## Проверки

```sh
pnpm verify                 # линтер, типы, модульные и интеграционные тесты, сборка
pnpm exec playwright install chromium
pnpm test:e2e               # браузерные проверки с отдельной production-сборкой
pnpm verify:all             # все проверки, включая браузерные
```

Vitest использует Node по умолчанию. Для UI-тестов добавляйте
`// @vitest-environment jsdom`; Testing Library настроена в `tests/setup.ts`.
Интеграционные тесты в `tests/integration/` используют PGlite: применяют миграции
и проверяют операции без облачных подключений. Они не проверяют Neon-транспорт
и конкурентные блокировки отдельных соединений.
Браузерные проверки выполняет пользователь. Браузерные тесты запускают
собственный сервер на порту 3100 без облачных секретов.

## Схема базы

Таблицы добавляются в предметные модули и реэкспортируются из
`src/shared/database/schema.ts`. Начальная миграция `0000_monthly_planning.sql`
создаёт приоритеты, месячные планы и журнал повторяемых операций.
Серверные функции — в `src/modules/monthly-plans/application/server.ts`;
публичных обработчиков пока нет. Контракт — в `docs/monthly-planning.md`.

```sh
pnpm db:generate            # создать SQL-миграцию из схемы (без подключения)
pnpm db:migrate             # применить проверенные миграции к DATABASE_URL
pnpm db:studio              # открыть интерфейс Drizzle Studio
```

Drizzle Kit читает те же `.env*` через загрузчик Next.js. Миграции хранятся в
`migrations/`, применяются отдельным шагом и не запускаются во время сборки.
Схемой Neon Auth управляет Neon; её не включаем в прикладные миграции.

## Vercel

Используйте существующий проект с этим репозиторием, preset Next.js и Node.js 24.
Установка: `pnpm install --frozen-lockfile`; сборка: `pnpm build`.
Укажите три переменные из `.env.example` отдельно для нужных окружений.
Preview должен использовать отдельную ветку Neon, а не production-данные.
При настройке входа добавьте фактические адреса приложения в доверенные адреса Neon Auth.

Локальная сборка не создаёт deployment и не изменяет облачную базу.

## Ограничение Neon SDK

`@neondatabase/auth` пока выпускается как beta. Его готовый UI транзитивно
подключает `better-call` 2, хотя плагин API-ключей Better Auth требует 1.3.7;
pnpm сообщает об этом peer-конфликте. Готовый Neon UI и API-ключи в приложении
не используются. Перед их подключением нужно устранить конфликт в SDK.
Версии Better Auth закреплены в `pnpm-workspace.yaml`, чтобы остальные
транзитивные пакеты соответствовали версии Neon SDK.
