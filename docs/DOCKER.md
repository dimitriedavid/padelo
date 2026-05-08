# Docker

## Production-style local stack

Start Postgres, backend, and static frontend:

```sh
docker compose up --build
```

Open:

```txt
http://localhost:8080
```

Run migrations:

```sh
docker compose run --rm migrate
```

The frontend container serves the built React app with nginx and proxies `/api`
to the backend service.

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
