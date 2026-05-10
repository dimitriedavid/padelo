# API

The frontend calls the backend through same-origin `/api` routes. In development, Vite proxies `/api` to `http://localhost:8123`.

## Conventions

- JSON requests and responses use `content-type: application/json`.
- Tournament responses are wrapped as `{ "tournament": ... }`.
- Event list responses are wrapped as `{ "events": ... }`.
- Error responses use `{ "error": string, "message"?: string, "details"?: unknown }`.
- Tournament write requests require `expectedStateVersion` so stale multi-device updates can be rejected.
- Match result scores must add up to the tournament `targetScore`.
- Tournament request bodies are limited to 64 KiB.

## Health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |

## Tournaments

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/tournaments` | Create a tournament |
| `GET` | `/api/tournaments/:roomCode` | Fetch a tournament |
| `POST` | `/api/tournaments/:roomCode/matches/:matchId/result` | Create or replace a match result |
| `DELETE` | `/api/tournaments/:roomCode/matches/:matchId/result` | Clear a match result |
| `POST` | `/api/tournaments/:roomCode/finish` | Mark a tournament finished |
| `POST` | `/api/tournaments/:roomCode/play-again` | Create a new tournament from finished settings |
| `GET` | `/api/tournaments/:roomCode/events` | Fetch durable tournament log events |
| `GET` | `/api/tournaments/:roomCode/stream` | Open a live server-sent events stream |

## Create Tournament

```json
{
  "name": "Friday Padel",
  "date": "2026-05-10",
  "mode": "americano",
  "players": ["Alex", "Bea", "Chris", "Dana", "Eli", "Fran", "Gia", "Hugo"],
  "courtCount": 2,
  "roundCount": { "type": "infinite" },
  "targetScore": 24
}
```

`mode` must be `americano` or `mexicano`.

`roundCount` can be open-ended:

```json
{ "type": "infinite" }
```

Or fixed:

```json
{ "type": "fixed", "value": 5 }
```

Validation limits:

| Field | Limit |
| --- | --- |
| `name` | 1 to 80 characters |
| `players` | 4 to 64 unique names |
| player name | 1 to 60 characters |
| `courtCount` | 1 to 16, and no more than `floor(players / 4)` |
| fixed rounds | 1 to 100 |
| `targetScore` | 1 to 99 |

## Write Requests

Use the tournament's current `stateVersion` from the most recent fetch or stream event.

Set or replace a result:

```json
{
  "sideAScore": 14,
  "sideBScore": 10,
  "expectedStateVersion": 3
}
```

Clear a result:

```json
{
  "expectedStateVersion": 4
}
```

Finish a tournament:

```json
{
  "expectedStateVersion": 8
}
```

If the expected version is stale, the backend returns a conflict so the client can refresh before writing again.

## Stream Events

`GET /api/tournaments/:roomCode/stream` returns `text/event-stream`.

Events:

| Event | Data |
| --- | --- |
| `connected` | Current serialized tournament |
| `tournament_updated` | Updated serialized tournament |

The stream also sends periodic keepalive comments.
