// Padelo brand primitives (ball, wordmark, avatar).
// Tailwind classes assume the Club Social shadcn theme is loaded.

import { cn } from "@/lib/utils";
import type { ScoreboardPlayer } from "./scoreboard-types";

type BallProps = {
  className?: string;
  color?: string;
};

export function PadeloBall({ className, color = "currentColor" }: BallProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("inline-block align-[-0.06em]", className)}
      viewBox="0 0 100 100"
    >
      <circle cx="50" cy="50" fill={color} r="44" />
      <path
        d="M28 14 C44 32 44 68 28 86"
        fill="none"
        stroke="var(--background)"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        d="M72 14 C56 32 56 68 72 86"
        fill="none"
        stroke="var(--background)"
        strokeLinecap="round"
        strokeWidth="8"
      />
    </svg>
  );
}

type WordmarkProps = {
  className?: string;
  ballClassName?: string;
};

export function PadeloWordmark({ className, ballClassName }: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-display font-bold tracking-tight text-primary",
        className,
      )}
    >
      <span>padel</span>
      <PadeloBall className={cn("size-[0.74em] -ml-[0.01em]", ballClassName)} />
    </span>
  );
}

type AvatarProps = {
  player: ScoreboardPlayer;
  className?: string;
  ringed?: boolean;
};

const MIN_AVATAR_HUE_DISTANCE = 48;

const DEFAULT_PLAYER_AVATAR_COLOR = { background: "hsl(153 46% 56%)", hue: 153 };

const PLAYER_AVATAR_COLORS = [
  DEFAULT_PLAYER_AVATAR_COLOR,
  { background: "hsl(24 68% 62%)", hue: 24 },
  { background: "hsl(218 62% 64%)", hue: 218 },
  { background: "hsl(48 72% 62%)", hue: 48 },
  { background: "hsl(286 50% 66%)", hue: 286 },
  { background: "hsl(352 66% 68%)", hue: 352 },
  { background: "hsl(184 58% 58%)", hue: 184 },
  { background: "hsl(96 46% 58%)", hue: 96 },
  { background: "hsl(252 52% 66%)", hue: 252 },
  { background: "hsl(12 70% 64%)", hue: 12 },
  { background: "hsl(202 64% 62%)", hue: 202 },
  { background: "hsl(326 58% 68%)", hue: 326 },
  { background: "hsl(38 72% 60%)", hue: 38 },
  { background: "hsl(170 50% 56%)", hue: 170 },
  { background: "hsl(232 54% 66%)", hue: 232 },
  { background: "hsl(72 54% 58%)", hue: 72 },
  { background: "hsl(304 48% 66%)", hue: 304 },
  { background: "hsl(4 62% 66%)", hue: 4 },
  { background: "hsl(128 42% 56%)", hue: 128 },
  { background: "hsl(270 48% 68%)", hue: 270 },
];

function playerAvatarColorAt(index: number) {
  return PLAYER_AVATAR_COLORS[index] ?? DEFAULT_PLAYER_AVATAR_COLOR;
}

function normalizeAvatarName(name: string) {
  return name.normalize("NFKC").trim().toLocaleLowerCase() || "player";
}

function hashAvatarName(name: string) {
  const normalizedName = normalizeAvatarName(name);
  let hash = 2166136261;

  for (const character of normalizedName) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;

  return hash >>> 0;
}

function hashNameToColorIndex(name: string) {
  return hashAvatarName(name) % PLAYER_AVATAR_COLORS.length;
}

function hueDistance(firstHue: number, secondHue: number) {
  const distance = Math.abs(firstHue - secondHue);

  return Math.min(distance, 360 - distance);
}

function closestUsedHueDistance(colorIndex: number, usedColorIndexes: number[]) {
  if (usedColorIndexes.length === 0) {
    return 360;
  }

  const color = playerAvatarColorAt(colorIndex);

  return Math.min(
    ...usedColorIndexes.map((usedColorIndex) =>
      hueDistance(color.hue, playerAvatarColorAt(usedColorIndex).hue),
    ),
  );
}

function pickAvatarColorIndex(preferredIndex: number, usedColorIndexes: number[]) {
  const canUseFreshColor = usedColorIndexes.length < PLAYER_AVATAR_COLORS.length;
  const availableIndexes = PLAYER_AVATAR_COLORS.map((_, index) => index).filter(
    (index) => !canUseFreshColor || !usedColorIndexes.includes(index),
  );

  if (
    availableIndexes.includes(preferredIndex) &&
    closestUsedHueDistance(preferredIndex, usedColorIndexes) >= MIN_AVATAR_HUE_DISTANCE
  ) {
    return preferredIndex;
  }

  return availableIndexes.reduce((bestIndex, candidateIndex) => {
    const bestDistance = closestUsedHueDistance(bestIndex, usedColorIndexes);
    const candidateDistance = closestUsedHueDistance(candidateIndex, usedColorIndexes);

    if (candidateDistance !== bestDistance) {
      return candidateDistance > bestDistance ? candidateIndex : bestIndex;
    }

    const preferredHue = playerAvatarColorAt(preferredIndex).hue;
    const bestPreferredDistance = hueDistance(playerAvatarColorAt(bestIndex).hue, preferredHue);
    const candidatePreferredDistance = hueDistance(
      playerAvatarColorAt(candidateIndex).hue,
      preferredHue,
    );

    return candidatePreferredDistance < bestPreferredDistance ? candidateIndex : bestIndex;
  }, availableIndexes[0] ?? preferredIndex);
}

export function playerAvatarColorForName(name: string) {
  return playerAvatarColorAt(hashNameToColorIndex(name)).background;
}

export function assignPlayerAvatarColors(players: ScoreboardPlayer[]) {
  const usedColorIndexes: number[] = [];
  const colorIndexesByPlayerId = new Map<string, number>();
  const sortedPlayers = [...players].sort((firstPlayer, secondPlayer) => {
    const nameCompare = normalizeAvatarName(firstPlayer.name).localeCompare(
      normalizeAvatarName(secondPlayer.name),
    );

    return nameCompare || firstPlayer.id.localeCompare(secondPlayer.id);
  });

  for (const player of sortedPlayers) {
    if (player.hue) {
      continue;
    }

    const preferredIndex = hashNameToColorIndex(player.name);
    const colorIndex = pickAvatarColorIndex(preferredIndex, usedColorIndexes);

    usedColorIndexes.push(colorIndex);
    colorIndexesByPlayerId.set(player.id, colorIndex);
  }

  return players.map((player) => ({
    ...player,
    hue:
      player.hue ??
      playerAvatarColorAt(colorIndexesByPlayerId.get(player.id) ?? hashNameToColorIndex(player.name))
        .background,
  }));
}

export function PlayerAvatar({ player, className, ringed }: AvatarProps) {
  const avatarColor = player.hue ?? playerAvatarColorForName(player.name);

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-sans font-medium",
        "size-7 text-[10px]",
        ringed && "ring-2 ring-background",
        className,
      )}
      style={{ backgroundColor: avatarColor, color: "oklch(0.234 0.012 162)" }}
    >
      {player.initials}
    </span>
  );
}

export function AvatarStack({
  players,
  size = "sm",
}: {
  players: ScoreboardPlayer[];
  size?: "xs" | "sm" | "md";
}) {
  const sizeClass = {
    xs: "size-6 text-[9px]",
    sm: "size-7 text-[10px]",
    md: "size-8 text-[11px]",
  }[size];

  return (
    <span className="inline-flex">
      {players.map((player, index) => (
        <PlayerAvatar
          className={cn(sizeClass, index > 0 && "-ml-2")}
          key={player.id}
          player={player}
          ringed
        />
      ))}
    </span>
  );
}
