## Padel Scoreboard Plan 🎾

### 1. Stack

```txt
Frontend: Vite + React + TypeScript
UI: Tailwind + shadcn/ui
Backend: Hono + TypeScript
DB: Postgres
ORM: Drizzle
Realtime: SSE
Deploy: Docker Compose + Cloudflared
```

---

## 2. Core pages

```txt
/                 landing / recent rooms
/new              create tournament
/t/:roomCode      tournament scoreboard
/t/:roomCode/done finished tournament
```

---

## 3. MVP features

### Create tournament

Inputs:

```txt
tournament name
mode: Americano | Mexicano
player names
number of courts
number of rounds / auto
target score
```

On submit:

```txt
generate unique room code
generate rounds
store config + state in DB
redirect to /t/:roomCode
```

Room code requirements:

```txt
unique
short enough to share verbally
hard enough to guess
case-insensitive
```

---

### Tournament room

Everyone with room code can:

```txt
view current round
enter match result
edit match result
finish tournament
```

Also:

```txt
save room in localStorage recent rooms
live updates via SSE
```

---

### Finished tournament

Show:

```txt
final leaderboard
all rounds/results
copy/share results
Play again with same settings
```

---

## 4. Persistence rules

All tournament data stored in DB permanently.

Tournament logs are also persisted permanently and can be viewed from the
tournament room.

---

## 5. DB schema

```txt
tournaments
- id
- room_code unique
- name
- config_json
- state_json
- state_version
- status: active | finished
- created_at
- updated_at
- finished_at
```

```txt
tournament_logs
- id
- tournament_id
- type
- payload_json
- created_at
```

---

## 6. API endpoints

```txt
POST   /api/tournaments
GET    /api/tournaments/:roomCode
POST   /api/tournaments/:roomCode/matches/:matchId/result
DELETE /api/tournaments/:roomCode/matches/:matchId/result
POST   /api/tournaments/:roomCode/finish
POST   /api/tournaments/:roomCode/play-again
GET    /api/tournaments/:roomCode/events
GET    /api/tournaments/:roomCode/stream
```

This is a starting point. We can adjust as needed during development.

`POST /matches/:matchId/result` creates or replaces a result.
`DELETE /matches/:matchId/result` clears a result.

Score/result input should be narrow. The client does not submit both team
scores directly. It submits the winning side and the losing side's score.
The winner score is the tournament target score from setup.

Example:

```json
{
  "winningSide": "A",
  "losingScore": 18,
  "expectedStateVersion": 7
}
```

If the tournament target score is `21`, the stored result becomes:

```json
{
  "sideAScore": 21,
  "sideBScore": 18
}
```

Use `expectedStateVersion` for optimistic concurrency. If two people edit the
same tournament at the same time, the server should reject stale updates and
the client should refresh.

---

## 7. Realtime

Use SSE:

```txt
GET /api/tournaments/:roomCode/stream
```

When score changes:

```txt
POST match result
update state
increment state_version
insert durable event
broadcast tournament_updated
```

Frontend refreshes state or receives payload.

Endpoint purposes:

```txt
/events = durable tournament history shown when users open logs
/stream = live SSE updates while users are viewing the tournament
```

---

## 8. Tournament state

Keep the DB flexible with JSON, but keep the application state typed in code.

Example tournament state:

```json
{
  "targetScore": 21,
  "currentRoundIndex": 0,
  "players": [
    { "id": "p1", "name": "Alex" },
    { "id": "p2", "name": "Bianca" },
    { "id": "p3", "name": "Chris" },
    { "id": "p4", "name": "Dana" }
  ],
  "rounds": [
    {
      "index": 0,
      "status": "active",
      "matches": [
        {
          "id": "m1",
          "courtNumber": 1,
          "sideA": ["p1", "p2"],
          "sideB": ["p3", "p4"],
          "result": {
            "winningSide": "A",
            "sideAScore": 21,
            "sideBScore": 18,
            "enteredAt": "2026-05-07T12:00:00.000Z"
          }
        }
      ]
    }
  ],
  "leaderboard": [
    {
      "playerId": "p1",
      "played": 1,
      "wins": 1,
      "pointsFor": 21,
      "pointsAgainst": 18,
      "pointDiff": 3
    }
  ]
}
```

State notes:

```txt
players are stable for the whole tournament
rounds/matches are generated from tournament config
fixed/auto rounds only for MVP; infinite rounds can be added later
Americano fixed/auto rounds are generated when the tournament is created
Mexicano starts with round 1 and appends the next round after each completed round
results are editable while tournament is active
leaderboard can be stored or recalculated from results
```

---

## 9. Round generation

Start simple.

Americano:

```txt
rotate players
generate pairs
avoid repeated partners in the first n - 1 rounds when all players fit on courts
every round has courts
fixed/auto rounds are generated when the tournament is created
score contributes to individual player totals
```

Mexicano:

```txt
first round can use initial/random seeding
following rounds pair players based on leaderboard/ranking
players with similar rankings play together
next round is generated when the current round is complete
score contributes to individual player totals
```

Don’t over-optimize algorithms at the start.

Auto rounds:

```txt
even player count: player count - 1
odd player count: player count
```

Pairing edge cases should be defined with the algorithm:

```txt
odd number of players
too few players
more courts than available matches
players sitting out / byes
incomplete final round
maximum practical player count
```

---

## 10. Local storage

```txt
recentRooms = [
  {
    code,
    name,
    lastOpenedAt,
    status
  }
]
```

Show recent rooms on homepage.

---

## 11. Build order

```txt
A. Backend API + DB
1. Docker Compose: backend + postgres
1.1. Scaffold Hono backend
1.2. Set up Drizzle + Postgres
1.3. Define typed tournament config/state
1.4. Implement API endpoints (without logic)
1.5. Implement Americano + Mexicano round generation
1.6. Implement match result updates + state_version checks
1.7. Implement durable events + SSE

B. Frontend
2. Scaffold Vite + React + TypeScript
3. Implement pages + routing
4. Implement API integration
5. Implement localStorage recent rooms
6. Implement UI + styling
```

MVP mantra:

```txt
No login. Room code is access. Everyone can edit. Ship fast.
```

## 12. Structure

```txt
docs/
frontend/
backend/
docker-compose.yml
```
