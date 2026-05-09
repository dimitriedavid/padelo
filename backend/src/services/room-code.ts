import { randomInt } from "node:crypto";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 12;
export const ROOM_CODE_MIN_LENGTH = 4;
export const ROOM_CODE_MAX_LENGTH = 32;
const ROOM_CODE_PATH_PATTERN = /^[A-Z0-9]+$/;

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  const code: string[] = [];

  for (let index = 0; index < length; index += 1) {
    const character = ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];

    if (!character) {
      throw new Error("Failed to generate room code character.");
    }

    code.push(character);
  }

  return code.join("");
}

export function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
}

export function isValidRoomCode(roomCode: string): boolean {
  const normalized = normalizeRoomCode(roomCode);

  return (
    normalized.length >= ROOM_CODE_MIN_LENGTH &&
    normalized.length <= ROOM_CODE_MAX_LENGTH &&
    ROOM_CODE_PATH_PATTERN.test(normalized)
  );
}
