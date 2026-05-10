# Padelo

Padelo is a web app for running Americano and Mexicano padel tournaments. It generates rounds, opens a shared live room, tracks match scores, keeps the leaderboard current, and lets players follow from a link or QR code.

Production site: [padelo.fun](https://padelo.fun)

## Features

- Americano and Mexicano tournament setup.
- Fixed-round or open-ended sessions.
- Room codes, shared URLs, and QR-friendly tournament rooms.
- Live score updates with server-sent events.
- Score validation against the configured target score.
- Optimistic concurrency checks for multi-device score entry.
- Player leaderboard, match history, tournament logs, and finished results pages.
- "Play again" flow that reuses a finished tournament's settings.
- Recent rooms saved locally in the browser.

## Stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, shadcn/ui-style components.
- Backend: Hono, TypeScript, Node.js.
- Database: PostgreSQL with Drizzle migrations.
- Realtime: server-sent events.
- Deployment: Docker Compose behind Cloudflare Tunnel.

## App Routes

| Route | Purpose |
| --- | --- |
| `/` | Home page and recent rooms |
| `/new` | Create a tournament |
| `/t/:roomCode` | Live tournament room |
| `/t/:roomCode/done` | Finished tournament results |

## Local Development

This repo has separate frontend and backend packages, not a root workspace. Install dependencies in each package.

Prerequisites:

- Node.js 22 or compatible.
- pnpm 10.18.1, preferably via Corepack.
- Docker, for the local PostgreSQL database.

Start the development database:

```sh
docker compose -p padelo-dev -f docker-compose.dev.yml up -d
```

Run the backend:

```sh
cd backend
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm run dev
```

Run the frontend in another terminal:

```sh
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` requests to the backend at `http://localhost:8123`.

Backend health check:

```sh
curl http://localhost:8123/health
```

Stop the development database without deleting data:

```sh
docker compose -p padelo-dev -f docker-compose.dev.yml down
```

## Useful Commands

Backend:

```sh
cd backend
pnpm test
pnpm typecheck
pnpm build
pnpm db:generate
pnpm db:migrate
```

Frontend:

```sh
cd frontend
pnpm test
pnpm typecheck
pnpm build
pnpm preview
```

## Documentation

- [API](docs/API.md)
- [Docker deployment](docs/DOCKER.md)
- [Feature notes](docs/FEATURES.md)
- [GitHub repo copy](docs/GITHUB.md)

## Environment

Root `.env` values are used by Docker Compose. Start from `.env.example` and change `POSTGRES_PASSWORD` before public deployment.

`backend/.env` is for local backend development. Its example points at the isolated development database on host port `5433`.

## Deployment

See [docs/DOCKER.md](docs/DOCKER.md) for the production Compose flow, expected Cloudflare Tunnel network, and request body limit notes.
