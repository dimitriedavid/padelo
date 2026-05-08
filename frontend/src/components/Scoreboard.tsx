// Padelo scoreboard screen — mobile-first, shadcn/ui + Tailwind.

import { House, MoreHorizontal, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { type KeyboardEvent, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PadeloWordmark, PlayerAvatar } from "./PadeloBrand";
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

function RoomCodeChip({ code, onClick }: { code: string; onClick: () => void }) {
  return (
    <Badge
      asChild
      className="h-9 cursor-pointer gap-1.5 rounded-md px-3 py-0.5 font-mono uppercase transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      variant="secondary"
    >
      <button aria-label={`Show QR code for room ${code}`} onClick={onClick} type="button">
        <span className="text-sm tracking-widest text-muted-foreground">Room</span>
        <span className="font-display text-base font-bold tracking-tight text-primary">{code}</span>
      </button>
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
    <div className="flex items-center gap-3 px-4 pb-3">
      <div className="flex flex-1 gap-2 overflow-x-auto">
        {Array.from({ length: total }, (_, index) => {
          const state = index === current ? "current" : index < current ? "done" : "future";

          return (
            <Button
              className={cn(
                "size-11 shrink-0",
                "font-display text-lg font-semibold tracking-tight tabular-nums",
                "transition-colors",
                state === "current" && "bg-primary text-primary-foreground",
                state === "done" && "bg-accent text-accent-foreground",
                state === "future" && "border bg-card text-muted-foreground",
              )}
              key={index}
              onClick={() => onChange?.(index)}
              size="icon"
              type="button"
              variant="ghost"
            >
              {index + 1}
            </Button>
          );
        })}
      </div>
      <div className="font-display tracking-tight text-primary tabular-nums">
        <span className="text-2xl font-bold">R{current + 1}</span>
        <span className="text-sm text-muted-foreground">/{total}</span>
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
  const players = `${team[0].name} & ${team[1].name}`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2",
        win ? "bg-accent-foreground text-accent" : "bg-muted/40",
      )}
    >
      <span
        className={cn(
          "w-4 text-xs font-semibold tracking-widest uppercase",
          win ? "opacity-70" : "text-muted-foreground",
        )}
      >
        {side}
      </span>
      <div className="min-w-0 flex-1 truncate text-base font-semibold">{players}</div>
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
  const openScoreEntry = () => onEnterScore(match.id);
  const onCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openScoreEntry();
    }
  };

  return (
    <div
      aria-label={`${pending ? "Enter" : "Edit"} score for court ${match.courtNumber}`}
      className="flex cursor-pointer touch-manipulation flex-col gap-2.5 rounded-2xl border bg-card p-3 shadow-sm transition-colors hover:bg-card/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:bg-muted/60"
      onClick={openScoreEntry}
      onKeyDown={onCardKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-2 px-1">
        <Badge className="h-8 rounded-md bg-accent px-2.5 py-1 text-sm font-semibold text-accent-foreground">
          Court {match.courtNumber}
        </Badge>
        {pending ? (
          <span className="text-sm font-semibold text-destructive">awaiting result</span>
        ) : (
          <span className="text-sm text-muted-foreground">final</span>
        )}
        <span className="ml-auto flex h-10 shrink-0 items-center px-3 text-base font-semibold text-primary">
          {pending ? "Enter >" : "Edit"}
        </span>
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
      <span className="truncate text-base font-semibold">{player.name}</span>
      {lead ? (
        <span className="text-[10px] font-bold tracking-widest text-primary uppercase">leader</span>
      ) : null}
      <div className="ml-auto flex items-baseline gap-2 font-display tracking-tight tabular-nums">
        <span className="text-lg font-bold">{player.wins}</span>
        <span className="text-base font-medium text-muted-foreground">{player.losses}</span>
        <span
          className={cn(
            "w-9 text-right text-sm font-semibold",
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
    <div className="flex gap-3 rounded-lg border bg-card px-3 py-2.5">
      <span className="w-18 shrink-0 text-sm text-muted-foreground">{ago}</span>
      <span className="flex-1 text-sm">{text}</span>
      {score ? (
        <span className="font-display text-sm font-bold text-primary tabular-nums">{score}</span>
      ) : null}
    </div>
  );
}

export function Scoreboard({
  tournament,
  log = [],
  onBack,
  onShare,
  onMore,
  onChangeRound,
  onEnterScore,
}: ScoreboardProps) {
  const [activeTab, setActiveTab] = useState("round");
  const [isRoomQrOpen, setIsRoomQrOpen] = useState(false);
  const round = tournament.rounds[tournament.currentRoundIndex];
  const pending = round?.matches.find((match) => match.result == null);
  const roomUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `/t/${tournament.roomCode}`;
    }

    return new URL(`/t/${encodeURIComponent(tournament.roomCode)}`, window.location.href).toString();
  }, [tournament.roomCode]);
  const sortedStandings = useMemo(
    () => [...tournament.standings].sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff),
    [tournament.standings],
  );

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b px-3 py-1">
        <PadeloWordmark className="text-2xl" />
        <div className="ml-auto flex items-center gap-2">
          <RoomCodeChip code={tournament.roomCode} onClick={() => setIsRoomQrOpen(true)} />
          <Button aria-label="Share room" className="size-11" onClick={onShare} size="icon" variant="outline">
            <Share2 className="size-5" />
          </Button>
          <Button aria-label="Home" className="size-11" onClick={onBack} size="icon" variant="outline">
            <House className="size-5" />
          </Button>
        </div>
      </header>

      <div className="px-4 pt-3.5 pb-1.5">
        <h1 className="font-display text-[28px] leading-tight font-semibold -tracking-[0.02em]">
          {tournament.name}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
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
          className="h-12 w-full justify-start gap-7 rounded-none border-b bg-transparent p-0 px-4"
          variant="line"
        >
          {[
            { id: "round", label: "Round" },
            { id: "standings", label: "Standings" },
            { id: "logs", label: "Logs" },
          ].map(({ id, label }) => (
            <TabsTrigger
              className={cn(
                "h-12 flex-none rounded-none border-0! bg-transparent px-0 py-0 text-base font-semibold shadow-none!",
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
            <div className="rounded-lg border border-dashed bg-card px-3 py-4 text-sm text-muted-foreground">
              No logs loaded yet.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <footer className="flex gap-2 border-t bg-background px-4 py-2 pb-3">
        <Button
          className="h-12 flex-1 text-base font-semibold"
          disabled={!pending}
          onClick={() => pending && onEnterScore(pending.id)}
          size="lg"
        >
          {pending ? `Enter score · Court ${pending.courtNumber}` : "Round complete"}
        </Button>
        <Button className="size-12" onClick={onMore} size="icon" variant="secondary">
          <MoreHorizontal className="size-5" />
        </Button>
      </footer>

      <Dialog onOpenChange={setIsRoomQrOpen} open={isRoomQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Room {tournament.roomCode}</DialogTitle>
            <DialogDescription>Scan this code to open the tournament room.</DialogDescription>
          </DialogHeader>
          <div className="mx-auto rounded-xl border bg-white p-3">
            <QRCodeSVG
              bgColor="#ffffff"
              fgColor="#15211b"
              includeMargin={false}
              level="M"
              size={224}
              value={roomUrl}
            />
          </div>
          <div className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            {roomUrl}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
