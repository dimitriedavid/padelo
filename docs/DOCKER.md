# Docker

## Production Deployment

This stack is designed to run behind a Cloudflare Tunnel container. The app
containers do not publish ports on the Docker host.

### Network

The production compose file expects an existing external Docker network:

```txt
cloudflared_cloudflare
```

The `frontend` and `backend` services join this network with stable aliases:

```txt
padelo-frontend
padelo-backend
```

`postgres` stays on the default Compose network only. The backend can still
connect to it at `postgres:5432` because both services share that default
network.

If the Cloudflare stack did not already create the network, create it once:

```sh
docker network create cloudflared_cloudflare
```

### Tunnel Routes

Recommended route:

```txt
padelo.fun -> http://padelo-frontend:80
```

The React app uses same-origin API calls like `/api/tournaments`. In
production, nginx inside the frontend container proxies `/api` to the backend
over Docker networking:

```txt
https://padelo.fun/api/... -> http://backend:8123/api/...
```

An API-specific hostname is optional:

```txt
api.padelo.fun -> http://padelo-backend:8123
```

The web frontend does not need `api.padelo.fun`; keep it only for direct API
access, debugging, or future external clients.

### Deploy

Copy the environment example and set a real database password:

```sh
cp .env.example .env
```

Start Postgres, run migrations, then start the app containers:

```sh
docker compose up -d postgres
docker compose run --rm --build migrate
docker compose up -d --build backend frontend
```

Check container health:

```sh
docker compose ps
```

Expected `PORTS` entries look like internal container ports only, for example
`80/tcp` or `8123/tcp`. They should not include host bindings such as
`0.0.0.0:8080->80/tcp`.

## Development database

Start Postgres only:

```sh
docker compose -f docker-compose.dev.yml up -d
```

Run the backend manually from `backend/`:

```sh
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm run dev
```

Run the frontend manually from `frontend/`:

```sh
pnpm install
pnpm dev
```

Open:

```txt
http://localhost:5173
```

The Vite development server proxies `/api` to the backend on `localhost:8123`
by default.

If you set custom `POSTGRES_*` values in the root `.env`, update
`backend/.env` so `DATABASE_URL` uses the same credentials.

## Environment

Copy `.env.example` to `.env` and change the Postgres password before deploying
anywhere public.
