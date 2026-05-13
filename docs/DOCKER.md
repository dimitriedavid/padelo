# Docker

## Production Deployment

This stack is designed to run behind a Cloudflare Tunnel container. The app
containers do not publish ports on the Docker host.

### Network

The production compose file expects these existing external Docker networks:

```txt
cloudflared_cloudflare
main-timescaledb
```

The `frontend` and `backend` services join this network with stable aliases:

```txt
padelo-frontend
padelo-backend
```

The `backend` and `migrate` services also join `main-timescaledb` so they can
reach the shared TimescaleDB/Postgres service over Docker DNS. The database is
not owned by this Compose file.

If the Cloudflare stack did not already create its network, create it once:

```sh
docker network create cloudflared_cloudflare
```

`main-timescaledb` should be created and owned by the database stack.

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

### Request Body Limits

Tournament API request bodies are capped at 64 KiB in both the app middleware
and the frontend nginx `/api/` proxy. Configure the Cloudflare route or WAF for
the same 64 KiB maximum on `/api/*` requests so oversized bodies are rejected at
the edge before they reach the tunnel.

### Deploy

Copy the environment example and set the production database URL:

```sh
cp .env.example .env
```

For the shared TimescaleDB service on `main-timescaledb`, the URL should look
like this. Replace `timescaledb` if your database container uses a different DNS
alias on that network.

```txt
DATABASE_URL=postgres://padelo:change-me@timescaledb:5432/padelo
```

Run migrations, then start the app containers:

```sh
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

### Migrating From Embedded Postgres

If production is still running the old Compose-managed `postgres` service, take
the app offline for writes, dump that database, restore it into the shared
TimescaleDB/Postgres service on `main-timescaledb`, then deploy this Compose
change.

Run these commands before replacing the old Compose file:

```sh
docker compose stop frontend backend
docker compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > padelo-prod.dump
```

Create the target role and database in the shared TimescaleDB/Postgres service:

```sh
export DB_HOST=timescaledb
export DB_NAME=padelo
export DB_USER=padelo
read -s DB_PASSWORD
read -s DB_ADMIN_PASSWORD

docker run --rm --network main-timescaledb -e PGPASSWORD="$DB_ADMIN_PASSWORD" postgres:16-alpine \
  psql -v ON_ERROR_STOP=1 -v db_user="$DB_USER" -v db_password="$DB_PASSWORD" \
  -h "$DB_HOST" -U postgres -d postgres \
  -c "create role :\"db_user\" login password :'db_password';"

docker run --rm --network main-timescaledb -e PGPASSWORD="$DB_ADMIN_PASSWORD" postgres:16-alpine \
  createdb -h "$DB_HOST" -U postgres --owner="$DB_USER" "$DB_NAME"
```

Restore the dump into the shared database:

```sh
docker run --rm -i --network main-timescaledb -e PGPASSWORD="$DB_PASSWORD" postgres:16-alpine \
  pg_restore -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --role="$DB_USER" \
  < padelo-prod.dump

docker run --rm --network main-timescaledb -e PGPASSWORD="$DB_PASSWORD" postgres:16-alpine \
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c 'select 1;'
```

After deploying this Compose file, set `.env` to the container-facing database
URL, run migrations, then recreate the app containers and remove the old
`postgres` orphan container:

```sh
printf 'DATABASE_URL=postgres://%s:%s@%s:5432/%s\n' "$DB_USER" "$DB_PASSWORD" "$DB_HOST" "$DB_NAME" > .env
docker compose run --rm --build migrate
docker compose up -d --build --remove-orphans backend frontend
docker compose ps
unset DB_PASSWORD DB_ADMIN_PASSWORD
```

Do not remove the old `postgres_data` Docker volume until the shared database is
verified and backed up.

## Local Development Database

Local development uses a host-level PostgreSQL service instead of Docker
Compose. This lets multiple local apps share one Postgres server while keeping
their app databases separate.

Create the Padelo role and database once:

```sh
createuser --login --pwprompt padelo
createdb --owner=padelo padelo
```

Use `padelo` as the local role password, or update `backend/.env` after copying
the example.

Run the backend manually from `backend/`:

```sh
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm run dev
```

`backend/.env.example` points at the host-level local database:

```txt
DATABASE_URL=postgres://padelo:padelo@localhost:5432/padelo
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

## Environment

Copy `.env.example` to `.env` and set `DATABASE_URL` before deploying anywhere
public.
