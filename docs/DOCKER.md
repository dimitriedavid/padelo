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

## Development stack

Start Vite and the Hono backend with bind mounts:

```sh
docker compose -f docker-compose.dev.yml up --build
```

Open:

```txt
http://localhost:5173
```

The development frontend proxies `/api` to the backend on `localhost:8123`.

## Environment

Copy `.env.example` to `.env` and change the Postgres password before deploying
anywhere public.
