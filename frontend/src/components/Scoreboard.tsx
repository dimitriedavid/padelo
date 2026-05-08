// Padelo scoreboard screen — mobile-first, shadcn/ui + Tailwind.

import { ChevronLeft, MoreHorizontal, Share2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AvatarStack, PadeloWordmark, PlayerAvatar } from "./PadeloBrand";
import type {
  ScoreboardLogEntry,
  ScoreboardMatch,
  ScoreboardStanding,
  ScoreboardTournament,
} from "./scoreboard-types";
import type { MatchSide } from "@/lib/types";

type ScoreboardProps = {
  tournament: ScoreboardTournament;
  log?: ScoreboardLogEntry[];
  upNext?: string | undefined;
  onBack?: () => void;
  onShare?: () => void;
  onMore?: () => void;
  onChangeRound?: ((index: number) => void) | undefined;
  onEnterScore: (matchId: string) => void;
};

function won(match: ScoreboardMatch, side: MatchSide) {
  return match.result?.winningSide === side;
}

function fmtDiff(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function RoomCodeChip({ code }: { code: string }) {
  return (
    <Badge className="gap-1 rounded-md px-2 py-1 font-mono text-xs uppercase" variant="secondary">
      <span className="text-[9px] tracking-widest text-muted-foreground">Room</span>
      <span className="font-display font-bold tracking-tight text-primary">{code}</span>
    </Badge>
  );
}

function RoundChips({
  total,
  current,
  onChange,
}: {
  total: number;
  current: number;
  onChange?: ((index: number) => void) | undefined;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pb-3">
      <div className="flex flex-1 gap-1 overflow-x-auto">
        {Array.from({ length: total }, (_, index) => {
          const state = index === current ? "current" : index < current ? "done" : "future";

          return (
            <button
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-md",
                "font-display text-sm font-semibold tracking-tight tabular-nums",
                "transition-colors",
                state === "current" && "bg-primary text-primary-foreground",
                state === "done" && "bg-accent text-accent-foreground",
                state === "future" && "border bg-card text-muted-foreground",
              )}
              key={index}
              onClick={() => onChange?.(index)}
              type="button"
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <div className="font-display tracking-tight text-primary tabular-nums">
        <span className="text-lg font-bold">R{current + 1}</span>
        <span className="text-xs text-muted-foreground">/{total}</span>
      </div>
    </div>
  );
}

function TeamRow({
  match,
  side,
  targetScore,
}: {
  match: ScoreboardMatch;
  side: MatchSide;
  targetScore: number;
}) {
  const team = side === "A" ? match.sideA : match.sideB;
  const score =
    match.result == null ? null : side === "A" ? match.result.sideAScore : match.result.sideBScore;
  const win = won(match, side);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5",
        win ? "bg-accent-foreground text-accent" : "bg-muted/40",
      )}
    >
      <span
        className={cn(
          "w-3 text-[10px] font-semibold tracking-widest uppercase",
          win ? "opacity-70" : "text-muted-foreground",
        )}
      >
        {side}
      </span>
      <AvatarStack players={team} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-semibold">{team[0].name}</div>
        <div className={cn("truncate text-[13px] font-semibold", win ? "opacity-80" : "text-muted-foreground")}>
          {team[1].name}
        </div>
      </div>
      <div
        className={cn(
          "font-display text-[38px] leading-none font-bold -tracking-[0.04em] tabular-nums",
          score == null ? "text-muted-foreground/30" : win ? "" : "text-muted-foreground",
        )}
      >
        {score == null ? "-" : score === targetScore ? targetScore : score}
      </div>
    </div>
  );
}

function CourtCard({
  match,
  targetScore,
  onEnterScore,
}: {
  match: ScoreboardMatch;
  targetScore: number;
  onEnterScore: (matchId: string) => void;
}) {
  const pending = match.result == null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2 px-1">
        <Badge className="gap-1.5 rounded-md font-medium" variant="outline">
          <span className="size-2 rounded-[1px] border-2 border-primary" />
          Court {match.courtNumber}
        </Badge>
        {pending ? (
          <span className="text-[11px] font-semibold text-destructive">awaiting result</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">final</span>
        )}
        <Button
          className="ml-auto h-auto p-0 text-primary"
          onClick={() => onEnterScore(match.id)}
          size="sm"
          variant="link"
        >
          {pending ? "Enter >" : "Edit"}
        </Button>
      </div>
      <TeamRow match={match} side="A" targetScore={targetScore} />
      <TeamRow match={match} side="B" targetScore={targetScore} />
    </div>
  );
}

function LeaderboardRow({ player, rank }: { player: ScoreboardStanding; rank: number }) {
  const lead = rank === 1;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        lead ? "border-accent bg-accent text-accent-foreground" : "bg-card",
      )}
    >
      <span
        className={cn(
          "w-5 text-right font-display text-base font-bold tracking-tight tabular-nums",
          lead ? "" : "text-muted-foreground",
        )}
      >
        {rank}
      </span>
      <PlayerAvatar player={player} />
      <span className="truncate text-sm font-semibold">{player.name}</span>
      {lead ? (
        <span className="text-[9px] font-bold tracking-widest text-primary uppercase">leader</span>
      ) : null}
      <div className="ml-auto flex items-baseline gap-2 font-display tracking-tight tabular-nums">
        <span className="text-[15px] font-bold">{player.wins}</span>
        <span className="text-[13px] font-medium text-muted-foreground">{player.losses}</span>
        <span
          className={cn(
            "w-8 text-right text-xs font-semibold",
            player.pointDiff < 0 ? "text-destructive" : "text-primary",
          )}
        >
          {fmtDiff(player.pointDiff)}
        </span>
      </div>
    </div>
  );
}

function LogEntry({ ago, text, score }: ScoreboardLogEntry) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card px-3 py-2">
      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{ago}</span>
      <span className="flex-1 text-xs">{text}</span>
      {score ? (
        <span className="font-display font-bold text-primary tabular-nums">{score}</span>
      ) : null}
    </div>
  );
}

export function Scoreboard({
  tournament,
  log = [],
  upNext,
  onBack,
  onShare,
  onMore,
  onChangeRound,
  onEnterScore,
}: ScoreboardProps) {
  const [activeTab, setActiveTab] = useState("round");
  const round = tournament.rounds[tournament.currentRoundIndex];
  const pending = round?.matches.find((match) => match.result == null);
  const sortedStandings = useMemo(
    () => [...tournament.standings].sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff),
    [tournament.standings],
  );

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Button onClick={onBack} size="icon" variant="ghost">
          <ChevronLeft className="size-5" />
        </Button>
        <PadeloWordmark className="text-xl" />
        <div className="ml-auto flex items-center gap-2">
          <RoomCodeChip code={tournament.roomCode} />
          <Button onClick={onShare} size="icon" variant="outline">
            <Share2 className="size-4" />
          </Button>
        </div>
      </header>

      <div className="px-4 pt-3.5 pb-1">
        <h1 className="font-display text-[22px] leading-tight font-semibold -tracking-[0.02em]">
          {tournament.name}
        </h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {tournament.mode} · {tournament.players.length} players · {tournament.courts} courts · target{" "}
          {tournament.targetScore}
        </p>
      </div>

      <RoundChips
        current={tournament.currentRoundIndex}
        onChange={onChangeRound}
        total={tournament.totalRounds}
      />

      <Tabs className="flex min-h-0 flex-1 flex-col" onValueChange={setActiveTab} value={activeTab}>
        <TabsList
          className="h-10 w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0 px-4"
          variant="line"
        >
          {[
            { id: "round", label: "Round" },
            { id: "standings", label: "Standings" },
            { id: "logs", label: "Logs" },
          ].map(({ id, label }) => (
            <TabsTrigger
              className={cn(
                "h-10 flex-none rounded-none border-0! bg-transparent px-0 py-0 text-[13px] font-semibold shadow-none!",
                "text-muted-foreground after:hidden data-active:text-foreground",
              )}
              key={id}
              value={id}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent className="m-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3" value="round">
          {round ? (
            <>
              {round.matches.map((match) => (
                <CourtCard
                  key={match.id}
                  match={match}
                  onEnterScore={onEnterScore}
                  targetScore={tournament.targetScore}
                />
              ))}
              {upNext ? (
                <div className="rounded-xl border border-dashed bg-secondary/50 px-3 py-2.5">
                  <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    up next · round {tournament.currentRoundIndex + 2}
                  </div>
                  <div className="mt-1 text-xs text-foreground/80">{upNext}</div>
                </div>
              ) : null}
            </>
          ) : (
            <Alert>
              <AlertDescription>No round available.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent className="m-0 flex-1 space-y-1 overflow-y-auto px-4 py-3" value="standings">
          {sortedStandings.map((player, index) => (
            <LeaderboardRow key={player.id} player={player} rank={index + 1} />
          ))}
        </TabsContent>

        <TabsContent className="m-0 flex-1 space-y-2 overflow-y-auto px-4 py-3" value="logs">
          {log.length > 0 ? (
            log.map((entry, index) => <LogEntry key={`${entry.ago}-${index}`} {...entry} />)
          ) : (
            <div className="rounded-lg border border-dashed bg-card px-3 py-4 text-xs text-muted-foreground">
              No logs loaded yet.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <footer className="flex gap-2 border-t bg-background px-4 py-3 pb-5">
        <Button
          className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
          disabled={!pending}
          onClick={() => pending && onEnterScore(pending.id)}
          size="lg"
        >
          {pending ? `Enter score · Court ${pending.courtNumber}` : "Round complete"}
        </Button>
        <Button className="h-12 rounded-xl" onClick={onMore} size="lg" variant="secondary">
          <MoreHorizontal className="size-5" />
        </Button>
      </footer>
    </div>
  );
}
