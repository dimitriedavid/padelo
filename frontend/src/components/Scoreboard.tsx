// Padelo scoreboard screen — mobile-first, shadcn/ui + Tailwind.

import { ChevronLeft, ChevronRight, House, MoreHorizontal, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  onBack?: () => void;
  onShare?: () => void;
  onMore?: () => void;
  onChangeRound?: ((index: number) => void) | undefined;
  onEnterScore: (matchId: string) => void;
};

function won(match: ScoreboardMatch, side: MatchSide) {
  return match.result?.winningSide === side;
}

function roundCountLabel(tournament: ScoreboardTournament) {
  return tournament.roundCount.type === "infinite" ? "∞ rounds" : `${tournament.roundCount.value} rounds`;
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

type RoundPageItem = number | "ellipsis-start" | "ellipsis-end";

function RoundPagination({
  total,
  current,
  activeRound,
  onChange,
  className,
}: {
  total: number;
  current: number;
  activeRound: number;
  onChange?: ((index: number) => void) | undefined;
  className?: string | undefined;
}) {
  const pages = paginationItems(total, current);
  const canGoPrevious = current > 0;
  const canGoNext = current < total - 1;

  return (
    <nav aria-label="Round pagination" className={cn("flex items-center justify-start gap-1", className)}>
      <Button
        aria-label="Previous round"
        className="size-10 shrink-0"
        disabled={!canGoPrevious}
        onClick={() => canGoPrevious && onChange?.(current - 1)}
        size="icon"
        type="button"
        variant="outline"
      >
        <ChevronLeft className="size-5" />
      </Button>

      {pages.map((page) => {
        if (typeof page !== "number") {
          return (
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center text-base font-semibold text-muted-foreground"
              key={page}
            >
              ...
            </span>
          );
        }

        const pageIndex = page - 1;
        const active = pageIndex === current;
        const complete = pageIndex < activeRound;

        return (
          <Button
            aria-current={active ? "page" : undefined}
            aria-label={`Round ${page}`}
            className={cn(
              "size-10 shrink-0 font-display text-base font-semibold tracking-tight tabular-nums",
              complete && !active && "border-accent bg-accent text-accent-foreground hover:bg-accent/80",
              active && "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            key={page}
            onClick={() => onChange?.(pageIndex)}
            size="icon"
            type="button"
            variant={active ? "default" : "outline"}
          >
            {page}
          </Button>
        );
      })}

      <Button
        aria-label="Next round"
        className="size-10 shrink-0"
        disabled={!canGoNext}
        onClick={() => canGoNext && onChange?.(current + 1)}
        size="icon"
        type="button"
        variant="outline"
      >
        <ChevronRight className="size-5" />
      </Button>
    </nav>
  );
}

function paginationItems(total: number, currentIndex: number): RoundPageItem[] {
  const current = currentIndex + 1;

  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, "ellipsis-end", total];
  }

  if (current >= total - 2) {
    return [1, "ellipsis-start", total - 2, total - 1, total];
  }

  return [1, "ellipsis-start", current, "ellipsis-end", total];
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
  const players = `${team[0].name} + ${team[1].name}`;

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
      <AvatarStack players={team} />
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
  editable,
  onEnterScore,
}: {
  match: ScoreboardMatch;
  targetScore: number;
  editable: boolean;
  onEnterScore: (matchId: string) => void;
}) {
  const pending = match.result == null;
  const openScoreEntry = () => onEnterScore(match.id);
  const onCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editable && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openScoreEntry();
    }
  };

  return (
    <div
      aria-label={`${editable ? (pending ? "Enter" : "Edit") : "View"} score for court ${match.courtNumber}`}
      className={cn(
        "flex touch-manipulation flex-col gap-2.5 rounded-2xl border bg-card p-3 shadow-sm transition-colors",
        editable
          ? "cursor-pointer hover:bg-card/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:bg-muted/60"
          : "cursor-default",
      )}
      onClick={editable ? openScoreEntry : undefined}
      onKeyDown={onCardKeyDown}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
    >
      <div className="flex items-center gap-2 px-1">
        <Badge className="h-8 rounded-md bg-accent px-2.5 py-1 text-sm font-semibold text-accent-foreground">
          Court {match.courtNumber}
        </Badge>
        {pending && editable ? (
          <span className="text-sm font-semibold text-destructive">awaiting result</span>
        ) : pending ? (
          <span className="text-sm font-semibold text-muted-foreground">locked</span>
        ) : (
          <span className="text-sm text-muted-foreground">final</span>
        )}
        <span
          className={cn(
            "ml-auto flex h-10 shrink-0 items-center px-3 text-base font-semibold",
            editable ? "text-primary" : "text-muted-foreground",
          )}
        >
          {editable ? (pending ? "Enter >" : "Edit") : "Locked"}
        </span>
      </div>
      <TeamRow match={match} side="A" targetScore={targetScore} />
      <TeamRow match={match} side="B" targetScore={targetScore} />
    </div>
  );
}

function LeaderboardRow({ player, rank }: { player: ScoreboardStanding; rank: number }) {
  const record = `${player.wins}W ${player.ties}T ${player.losses}L`;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      <span className="w-5 text-right font-display text-base font-bold tracking-tight text-muted-foreground tabular-nums">
        {rank}
      </span>
      <PlayerAvatar player={player} />
      <span className="truncate text-base font-semibold">{player.name}</span>
      <div className="ml-auto text-right tabular-nums">
        <div className="font-display text-2xl leading-none font-bold tracking-tight text-primary">{player.points}</div>
        <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{record}</div>
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
  const [roundAnnouncement, setRoundAnnouncement] = useState<number | null>(null);
  const previousActiveRoundRef = useRef({
    activeRoundIndex: tournament.activeRoundIndex,
    roomCode: tournament.roomCode,
  });
  const round = tournament.rounds[tournament.currentRoundIndex];
  const activeRound = tournament.rounds[tournament.activeRoundIndex];
  const currentRoundHasNoScores = activeRound?.matches.every((match) => match.result == null) ?? false;
  const isLastCompletedRound =
    tournament.currentRoundIndex === tournament.activeRoundIndex - 1 && round?.status === "complete";
  const isRoundEditable =
    tournament.currentRoundIndex === tournament.activeRoundIndex ||
    (isLastCompletedRound && currentRoundHasNoScores);
  const roomUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `/t/${tournament.roomCode}`;
    }

    return new URL(`/t/${encodeURIComponent(tournament.roomCode)}`, window.location.href).toString();
  }, [tournament.roomCode]);
  const sortedStandings = useMemo(
    () =>
      [...tournament.standings].sort(
        (a, b) => b.points - a.points || b.wins - a.wins || b.ties - a.ties || b.pointDiff - a.pointDiff,
      ),
    [tournament.standings],
  );

  useEffect(() => {
    const previous = previousActiveRoundRef.current;

    if (
      previous.roomCode === tournament.roomCode &&
      tournament.activeRoundIndex > previous.activeRoundIndex
    ) {
      setRoundAnnouncement(tournament.activeRoundIndex + 1);
    }

    previousActiveRoundRef.current = {
      activeRoundIndex: tournament.activeRoundIndex,
      roomCode: tournament.roomCode,
    };
  }, [tournament.activeRoundIndex, tournament.roomCode]);

  useEffect(() => {
    if (roundAnnouncement === null) {
      return;
    }

    const timeout = window.setTimeout(() => setRoundAnnouncement(null), 1200);

    return () => window.clearTimeout(timeout);
  }, [roundAnnouncement]);

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
          {tournament.targetScore} · {roundCountLabel(tournament)}
        </p>
      </div>

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

        <TabsContent className="relative m-0 flex-1 overflow-y-auto px-4 py-3" value="round">
          <div
            className={cn(
              "space-y-2.5 transition-[filter,opacity] duration-200",
              roundAnnouncement !== null && "blur-[3px] opacity-70",
            )}
          >
            {round ? (
              <>
                {round.matches.map((match) => (
                  <CourtCard
                    key={match.id}
                    match={match}
                    editable={isRoundEditable}
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
          </div>

          {roundAnnouncement !== null ? (
            <div
              aria-live="polite"
              className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-background/25 backdrop-blur-[2px]"
              role="status"
            >
              <div
                className="animate-round-advance font-display text-6xl leading-none font-bold tracking-tight text-primary"
                key={roundAnnouncement}
              >
                Round {roundAnnouncement}
              </div>
            </div>
          ) : null}
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

      <footer className="flex items-center gap-2 border-t bg-background px-4 py-2 pb-3">
        <RoundPagination
          activeRound={tournament.activeRoundIndex}
          className="min-w-0 flex-1 px-0 pb-0"
          current={tournament.currentRoundIndex}
          onChange={onChangeRound}
          total={tournament.totalRounds}
        />
        <Button aria-label="More actions" className="size-10" onClick={onMore} size="icon" variant="outline">
          <MoreHorizontal className="size-5" />
        </Button>
      </footer>

      <Dialog onOpenChange={setIsRoomQrOpen} open={isRoomQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Room {tournament.roomCode}</DialogTitle>
            <DialogDescription>Scan this code to open the tournament room.</DialogDescription>
          </DialogHeader>
          <div className="mx-auto bg-white p-3">
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
