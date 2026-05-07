import type {
  CreateTournamentRequest,
  DeleteMatchResultRequest,
  Tournament,
  TournamentEvent,
  UpsertMatchResultRequest,
} from "./types";

type TournamentResponse = {
  tournament: Tournament;
};

type EventsResponse = {
  events: TournamentEvent[];
};

type ApiErrorBody = {
  error?: string;
  message?: string;
  details?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function createTournament(payload: CreateTournamentRequest): Promise<Tournament> {
  const body = await request<TournamentResponse>("/api/tournaments", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return body.tournament;
}

export async function getTournament(roomCode: string): Promise<Tournament> {
  const body = await request<TournamentResponse>(`/api/tournaments/${encodeURIComponent(roomCode)}`);

  return body.tournament;
}

export async function upsertMatchResult(
  roomCode: string,
  matchId: string,
  payload: UpsertMatchResultRequest,
): Promise<Tournament> {
  const body = await request<TournamentResponse>(
    `/api/tournaments/${encodeURIComponent(roomCode)}/matches/${encodeURIComponent(matchId)}/result`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return body.tournament;
}

export async function deleteMatchResult(
  roomCode: string,
  matchId: string,
  payload: DeleteMatchResultRequest,
): Promise<Tournament> {
  const body = await request<TournamentResponse>(
    `/api/tournaments/${encodeURIComponent(roomCode)}/matches/${encodeURIComponent(matchId)}/result`,
    {
      method: "DELETE",
      body: JSON.stringify(payload),
    },
  );

  return body.tournament;
}

export async function finishTournament(roomCode: string): Promise<Tournament> {
  const body = await request<TournamentResponse>(
    `/api/tournaments/${encodeURIComponent(roomCode)}/finish`,
    {
      method: "POST",
    },
  );

  return body.tournament;
}

export async function playAgain(roomCode: string): Promise<Tournament> {
  const body = await request<TournamentResponse>(
    `/api/tournaments/${encodeURIComponent(roomCode)}/play-again`,
    {
      method: "POST",
    },
  );

  return body.tournament;
}

export async function getTournamentEvents(roomCode: string): Promise<TournamentEvent[]> {
  const body = await request<EventsResponse>(`/api/tournaments/${encodeURIComponent(roomCode)}/events`);

  return body.events;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const body = await readJson(response);

  if (!response.ok) {
    const errorBody = isObject(body) ? (body as ApiErrorBody) : {};

    throw new ApiError(
      response.status,
      errorBody.error ?? "request_failed",
      errorBody.message ?? "Request failed.",
      errorBody.details,
    );
  }

  return body as T;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

