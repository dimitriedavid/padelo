import type { Tournament } from "../lib/types";
import { playerName, sortLeaderboard } from "../lib/tournament";
import { LeaderboardPanel, type LeaderboardPanelRow } from "./LeaderboardPanel";
import { assignPlayerAvatarColors } from "./PadeloBrand";
import type { ScoreboardPlayer } from "./scoreboard-types";

type LeaderboardProps = {
  tournament: Tournament;
};

export function Leaderboard({ tournament }: LeaderboardProps) {
  const entries = sortLeaderboard(tournament);
  const avatarPlayers = assignPlayerAvatarColors(tournament.state.players.map(toAvatarPlayer));
  const playersById = new Map(avatarPlayers.map((player) => [player.id, player]));
  const rows: LeaderboardPanelRow[] = entries.map((entry, index) => {
    const player = playersById.get(entry.playerId) ?? fallbackAvatarPlayer(tournament, entry.playerId);
    const losses = Math.max(0, entry.played - entry.wins - (entry.ties ?? 0));

    return {
      id: entry.playerId,
      name: playerName(tournament, entry.playerId),
      player,
      points: entry.pointsFor,
      rank: index + 1,
      record: `${entry.wins}W ${(entry.ties ?? 0)}T ${losses}L`,
    };
  });

  return <LeaderboardPanel rows={rows} />;
}

function toAvatarPlayer(player: { id: string; name: string }): ScoreboardPlayer {
  return {
    id: player.id,
    name: player.name,
    initials: initialsFor(player.name),
  };
}

function fallbackAvatarPlayer(tournament: Tournament, playerId: string): ScoreboardPlayer {
  const name = playerName(tournament, playerId);

  return {
    id: playerId,
    name,
    initials: initialsFor(name),
  };
}

function initialsFor(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length > 1 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : value.slice(0, 2);

  return initials.toUpperCase();
}
