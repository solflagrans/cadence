# Vercel and Neon setup

Cadence runs as a Next.js application on Vercel. The `/api/state` Route Handler
stores one JSON document per user in Neon Postgres, while the browser keeps a
local backup in `localStorage`.

## Deploy

1. Import the GitHub repository into a Vercel Hobby project.
2. In the Vercel project, open **Storage**, add the **Neon** integration, and
   connect it to Production, Preview, and Development.
3. Confirm that the integration created the `DATABASE_URL` environment variable.
4. Redeploy the project.

Vercel automatically runs `npm run build`. The build applies the idempotent
database migration before compiling Next.js, so a deployment without Neon
configuration fails early instead of publishing a broken API.

No custom build command or output directory is required.

## Local development

Create `.env.local` from `.env.example` and use a Neon development branch:

```sh
npm install
npm run db:migrate
npm run dev
```

Without `DATABASE_URL`, the interface still runs locally and uses its
`localStorage` backup, while cloud synchronization reports an error.
