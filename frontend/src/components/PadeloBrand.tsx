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
      <circle cx="50" cy="50" fill="none" r="44" stroke={color} strokeWidth="9" />
      <path
        d="M 14 32 Q 50 50 14 68"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="7"
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
      <PadeloBall className={cn("size-[0.74em] -ml-[0.04em]", ballClassName)} />
    </span>
  );
}

type AvatarProps = {
  player: ScoreboardPlayer;
  className?: string;
  ringed?: boolean;
};

const HUE_FALLBACK = [
  "bg-primary text-primary-foreground",
  "bg-destructive text-destructive-foreground",
  "bg-foreground text-background",
  "bg-accent-foreground text-accent",
  "bg-muted-foreground text-background",
];

export function PlayerAvatar({ player, className, ringed }: AvatarProps) {
  const hueClass =
    HUE_FALLBACK[
      [...player.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) %
        HUE_FALLBACK.length
    ];

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-sans font-medium",
        "size-7 text-[10px]",
        ringed && "ring-2 ring-background",
        hueClass,
        className,
      )}
      style={player.hue ? { background: player.hue, color: "var(--card)" } : undefined}
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
