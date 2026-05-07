import type { LeaderboardEntry, TournamentPlayer, TournamentRound } from "../types/tournament.js";

export function calculateLeaderboard(
  players: TournamentPlayer[],
  rounds: TournamentRound[],
): LeaderboardEntry[] {
  const playerOrder = new Map(players.map((player, index) => [player.id, index]));
  const entries = new Map<string, LeaderboardEntry>();

  for (const player of players) {
    entries.set(player.id, {
      playerId: player.id,
      played: 0,
      wins: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    });
  }

  for (const round of rounds) {
    for (const match of round.matches) {
      if (!match.result) {
        continue;
      }

      applySideResult(entries, match.sideA, match.result.sideAScore, match.result.sideBScore);
      applySideResult(entries, match.sideB, match.result.sideBScore, match.result.sideAScore);

      const winningPlayers = match.result.winningSide === "A" ? match.sideA : match.sideB;

      for (const playerId of winningPlayers) {
        const entry = entries.get(playerId);

        if (entry) {
          entry.wins += 1;
        }
      }
    }
  }

  return [...entries.values()].sort((a, b) => {
    const wins = b.wins - a.wins;

    if (wins !== 0) {
      return wins;
    }

    const pointDiff = b.pointDiff - a.pointDiff;

    if (pointDiff !== 0) {
      return pointDiff;
    }

    const pointsFor = b.pointsFor - a.pointsFor;

    if (pointsFor !== 0) {
      return pointsFor;
    }

    return (playerOrder.get(a.playerId) ?? 0) - (playerOrder.get(b.playerId) ?? 0);
  });
}

function applySideResult(
  entries: Map<string, LeaderboardEntry>,
  playerIds: [string, string],
  pointsFor: number,
  pointsAgainst: number,
): void {
  for (const playerId of playerIds) {
    const entry = entries.get(playerId);

    if (!entry) {
      continue;
    }

    entry.played += 1;
    entry.pointsFor += pointsFor;
    entry.pointsAgainst += pointsAgainst;
    entry.pointDiff = entry.pointsFor - entry.pointsAgainst;
  }
}

