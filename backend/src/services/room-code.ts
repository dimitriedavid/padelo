import { randomInt } from "node:crypto";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_ROOM_CODE_LENGTH = 6;

export function generateRoomCode(length = DEFAULT_ROOM_CODE_LENGTH): string {
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
