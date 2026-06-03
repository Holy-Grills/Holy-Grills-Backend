# Holy Grills Backend

This is the backend API foundation for Holy Grills.

## Current Stack

- Node.js
- TypeScript
- Fastify
- Supabase Postgres
- Prisma
- Custom backend auth with Google OAuth planned
- BullMQ/Redis for jobs and scheduled workflows

## Auth Direction

Holy Grills currently uses custom backend auth as the identity authority. Supabase is used for the PostgreSQL database, not as the auth authority.

That means:

- Email/password users live in the Holy Grills `users` table.
- API access tokens are issued by this backend.
- "Continue with Google" should be implemented through backend-managed Google OAuth and linked to the same `users` table.
- Avoid mixing Supabase Auth users with custom backend users unless the auth architecture is intentionally changed.

## Frontend URL Variables

These values in `.env.example` are frontend origins and link targets, not separate backend ports:

```text
APP_BASE_URL=http://localhost:3000
ADMIN_BASE_URL=http://localhost:3001
KITCHEN_BASE_URL=http://localhost:3002
RIDER_BASE_URL=http://localhost:3003
```

They can all point to one frontend app if the frontend serves student, admin, kitchen, and rider views from different routes. They are separate only if we choose to run separate frontend apps or subdomains.

## First Commands

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## API Base

Default local API:

```text
http://localhost:4000/api/v1
```

Health check:

```text
GET /api/v1/health
```

Redis health check:

```text
GET /api/v1/health/redis
```

Swagger/OpenAPI docs:

```text
GET /docs
GET /docs/json
```

## RDP/IP Hosting

For a server hosted at `18.207.92.217` with the API exposed directly on port `4000`, use:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=4000
API_BASE_URL=http://18.207.92.217:4000
GOOGLE_OAUTH_REDIRECT_URL=http://18.207.92.217:4000/api/v1/auth/google/callback
CORS_ORIGINS=http://18.207.92.217:3000,http://18.207.92.217:4000
```

Google OAuth console values:

```text
Authorised JavaScript origins:
http://18.207.92.217:3000
http://18.207.92.217:4000

Authorised redirect URI:
http://18.207.92.217:4000/api/v1/auth/google/callback
```

If the API is later placed behind Nginx on port `80` or a domain, update `API_BASE_URL`, `GOOGLE_OAUTH_REDIRECT_URL`, and Google Console to the public URL users actually visit.

## GitHub Actions Deployment

Pushes to `main` can deploy automatically to the Windows VPS through `.github/workflows/deploy-vps.yml`.

Add these repository secrets in GitHub:

```text
VPS_HOST=18.207.92.217
VPS_USER=Administrator
VPS_SSH_PORT=22
VPS_APP_DIR=C:\Users\Administrator\Desktop\Holy-Grills-Backend
VPS_SSH_KEY=<private SSH key for the VPS user>
```

The VPS must have:

- Git
- Node.js
- PM2 installed globally
- OpenSSH Server enabled
- The backend repo cloned at `VPS_APP_DIR`
- A private `.env` file in `VPS_APP_DIR`

The deploy script runs:

```text
git fetch origin main
git reset --hard origin/main
npm ci
npx prisma generate
npm run build
pm2 restart holy-grills-backend --update-env
```
