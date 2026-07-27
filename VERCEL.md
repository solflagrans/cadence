# Vercel and Neon setup

Cadence runs as a Next.js application on Vercel. The `/api/state` Route Handler
stores one JSON document per user in Neon Postgres, while the browser keeps a
local backup in `localStorage`.

## Deploy

1. Import the GitHub repository into a Vercel Hobby project.
2. In the Vercel project, open **Storage**, add the **Neon** integration, and
   connect it to Production, Preview, and Development.
3. Confirm that the integration created the `DATABASE_URL` environment variable.
4. Enable **Auth** for the database in the Vercel Neon integration or the
   Neon Console.
5. Confirm that the integration added `NEON_AUTH_BASE_URL`; if it did not,
   copy the value from Neon Auth into the Vercel project.
6. Generate a stable secret with `openssl rand -base64 32` and add it to
   Vercel as `NEON_AUTH_COOKIE_SECRET`.
7. Redeploy the project.

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

Without the Neon Auth variables, the interface still runs locally in guest
mode. Guest data is stored only in `localStorage`; authenticated users receive
a separate local backup and a cloud state row tied to their server-verified
account.
