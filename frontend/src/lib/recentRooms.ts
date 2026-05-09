import type { RecentRoom, Tournament } from "./types";

const RECENT_ROOMS_KEY = "padelo.recentRooms";
const MAX_RECENT_ROOMS = 8;

export function getRecentRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isRecentRoom).slice(0, MAX_RECENT_ROOMS);
  } catch {
    return [];
  }
}

export function saveRecentTournament(tournament: Tournament): RecentRoom[] {
  const room: RecentRoom = {
    code: tournament.roomCode,
    name: tournament.name,
    ...(tournament.config.date ? { date: tournament.config.date } : {}),
    lastOpenedAt: new Date().toISOString(),
    mode: tournament.config.mode,
    playerCount: tournament.config.players.length,
    status: tournament.status,
  };
  const rooms = [room, ...getRecentRooms().filter((candidate) => candidate.code !== room.code)].slice(
    0,
    MAX_RECENT_ROOMS,
  );

  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms));

  return rooms;
}

export function clearRecentRooms(): void {
  localStorage.removeItem(RECENT_ROOMS_KEY);
}

function isRecentRoom(value: unknown): value is RecentRoom {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<RecentRoom>;

  return (
    typeof candidate.code === "string" &&
    typeof candidate.name === "string" &&
    (candidate.date === undefined || typeof candidate.date === "string") &&
    typeof candidate.lastOpenedAt === "string" &&
    (candidate.mode === undefined || candidate.mode === "americano" || candidate.mode === "mexicano") &&
    (candidate.playerCount === undefined ||
      (typeof candidate.playerCount === "number" &&
        Number.isInteger(candidate.playerCount) &&
        candidate.playerCount >= 0)) &&
    (candidate.status === "active" || candidate.status === "finished")
  );
}
