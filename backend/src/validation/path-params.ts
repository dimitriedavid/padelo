import { badRequest } from "../domain/errors.js";
import {
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_MAX_LENGTH,
  ROOM_CODE_MIN_LENGTH,
} from "../services/room-code.js";

export const MATCH_ID_MAX_LENGTH = 24;

const MATCH_ID_PATTERN = /^r[1-9][0-9]{0,8}m[1-9][0-9]{0,8}$/;

export function parseRoomCodeParam(input: string): string {
  const roomCode = normalizeRoomCode(input);

  if (!isValidRoomCode(roomCode)) {
    throw badRequest("invalid_room_code", "Room code is invalid.", {
      field: "roomCode",
      minLength: ROOM_CODE_MIN_LENGTH,
      maxLength: ROOM_CODE_MAX_LENGTH,
      allowedPattern: "A-Z and 0-9",
    });
  }

  return roomCode;
}

export function parseMatchIdParam(input: string): string {
  const matchId = input.trim().toLowerCase();

  if (matchId.length > MATCH_ID_MAX_LENGTH || !MATCH_ID_PATTERN.test(matchId)) {
    throw badRequest("invalid_match_id", "Match ID is invalid.", {
      field: "matchId",
      maxLength: MATCH_ID_MAX_LENGTH,
      allowedPattern: "r<number>m<number>",
    });
  }

  return matchId;
}
