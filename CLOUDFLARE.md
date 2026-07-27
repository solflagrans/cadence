# Cloudflare Workers setup

Cadence is deployed as one Worker: the static SPA is served from `dist`, while `/api/*` is handled by `worker/index.ts` and backed by D1.

## One-time database setup

The `DB` binding in `wrangler.jsonc` points to the `cadence` D1 database. Apply the schema before using the deployed API:

```sh
npm run db:migrate:remote
```

## Local full-stack preview

```sh
npm run build
npm run db:migrate:local
npm run preview
```

Wrangler serves the static build, runs the API Worker, and uses a local D1 database. The regular `npm run dev` command remains a frontend-only Next.js development server, so cloud saves are expected to fail there while the local backup remains available.

## Workers Builds

Connect the repository to the existing `cadence` Worker and use:

- Build command: `npm run build`
- Deploy command: `npm run deploy`

The `wrangler.jsonc` file is the source of truth for the Worker, Static Assets, observability, and the `DB` binding.
