# Cadence architecture

Cadence uses a layered frontend architecture so product logic is independent
from React, Neon, and browser storage.

## Layers

- `src/domain` — planner and identity models, validation, selectors, and pure
  commands. This layer has no React or infrastructure dependencies.
- `src/application` — use cases and orchestration: planner state, navigation,
  synchronization, and server-side state services.
- `src/infrastructure` — replaceable adapters for Neon Auth, Neon Postgres,
  HTTP, and `localStorage`.
- `src/features` — product screens and feature-specific UI.
- `src/widgets` — composed interface blocks shared by multiple screens.
- `src/shared` — generic UI primitives, configuration, styles, and utilities.
- `app` — thin Next.js routes and compatibility exports used during the
  migration to the new structure.

Dependencies should point inward: UI and infrastructure may depend on the
application/domain layers, while the domain must not depend on either.

## Persistence

Guests use the local cache only. Signed-in users load and save through the
`StateRepository`; the current implementation combines the API gateway with a
local backup. Neon-specific database access stays behind server repositories,
so auth or database providers can be replaced without changing product logic.

## Database changes

Migrations are versioned in `migrations/` and recorded in
`schema_migrations`. Deployment builds do not mutate the database:

```bash
pnpm db:migrate
pnpm build
```

Run migrations as an explicit deployment step with `DATABASE_URL` configured.

## Verification

```bash
pnpm verify
pnpm test:e2e
```

`verify` runs linting, type checking, unit tests, and a production build.
Playwright smoke tests cover both desktop and mobile navigation.
