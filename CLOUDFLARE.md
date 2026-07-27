# Cloudflare Pages setup

Cadence builds as a static SPA while `/api/state` runs as a Cloudflare Pages Function backed by D1.

## One-time setup

1. Create the D1 database:

   ```sh
   npx wrangler d1 create cadence
   ```

2. Replace the placeholder `database_id` in `wrangler.jsonc` with the returned ID.
3. Apply the migration:

   ```sh
   npm run db:migrate:remote
   ```

## Local full-stack preview

```sh
npm run build
npm run db:migrate:local
npm run preview
```

The preview is served by Wrangler with a local D1 database. The regular `npm run dev` command still runs the frontend-only Next.js development server, so remote saves are expected to fail there while the local backup remains available.

## Cloudflare Pages

Connect the repository to Pages and use:

- Build command: `npm run build`
- Build output directory: `dist`

The `wrangler.jsonc` file is the source of truth for the Pages configuration and the `DB` binding.
