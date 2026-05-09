const ROOM_CODE_PATH_PATTERN = /(\/api\/tournaments\/)([^/?#\s]+)/g;

export function writeAccessLog(message: string, ...rest: string[]): void {
  console.log(maskRoomCodesInAccessLog(message), ...rest);
}

export function maskRoomCodesInAccessLog(message: string): string {
  return message.replace(ROOM_CODE_PATH_PATTERN, "$1:roomCode");
}
