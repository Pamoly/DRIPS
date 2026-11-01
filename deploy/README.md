# Deploying DRIPS

Three supported paths. The app is a standard Next.js 15 server (`next start`) with a JSON data store in `.data/`.

## 1. Local / single VM (npm)

```bash
npm ci
npm run build
DRIPS_SECRET="$(openssl rand -hex 32)" npm start   # http://localhost:3000
```

`npm start` binds `0.0.0.0:$PORT` (default `3000`), so it is reachable from other devices on your network.
For a permanent install use systemd: `deploy/drips.service` + `deploy/nginx.conf` for TLS and a reverse proxy.

## 2. Docker

```bash
docker compose up -d --build
# → http://localhost:3000  (data persisted in ./docker-data)
```

or without compose:

```bash
docker build -t drips-seo .
docker run -d --name drips -p 3000:3000 \
  -e DRIPS_SECRET="$(openssl rand -hex 32)" \
  -e DRIPS_SECURE_COOKIES=true \
  -v "$PWD/docker-data:/app/.data" \
  drips-seo
```

## 3. Managed platforms (Vercel, Render, Fly.io, Railway)

- Build command: `npm run build`
- Start command: `npm start`
- Node 22+
- Env: `DRIPS_SECRET` (required), `DRIPS_SECURE_COOKIES=true` when served over HTTPS
- Attach a persistent volume at `.data` (serverless platforms need a real database — swap `lib/store.ts` for Postgres/Prisma)

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Bind port |
| `DRIPS_SECRET` | dev fallback | HMAC key for session cookies — set in production |
| `DRIPS_SECURE_COOKIES` | `false` | Mark the session cookie `Secure` (enable behind HTTPS) |

## Health check

`GET /api/health` → `{ status: "ok", version, env, uptimeSeconds, counts }` (no auth, used by Docker/compose/systemd checks).

## Data & backups

All workspace state lives in `.data/db.json` (created on first request). Back that file up, or mount a volume.
Delete it to reseed the three demo projects.
