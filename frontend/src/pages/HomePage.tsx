import { Link2, Plus, QrCode, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MetadataLine } from "../components/MetadataLine";
import { PageShell } from "../components/PageShell";
import { DEFAULT_SEO_DESCRIPTION, DEFAULT_SEO_TITLE, Seo } from "../components/Seo";
import { clearRecentRooms, getRecentRooms } from "../lib/recentRooms";
import { displayMode, formatShortTournamentDate } from "../lib/tournament";
import type { RecentRoom } from "../lib/types";

export function HomePage() {
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);

  useEffect(() => {
    setRecentRooms(getRecentRooms());
  }, []);

  const onClear = () => {
    clearRecentRooms();
    setRecentRooms([]);
  };

  return (
    <PageShell>
      <Seo
        description={DEFAULT_SEO_DESCRIPTION}
        path="/"
        structuredData="webApplication"
        title={DEFAULT_SEO_TITLE}
      />
      <div className="mx-auto max-w-3xl space-y-7">
        <section className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
              Run a padel tournament
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Padelo creates Americano and Mexicano rounds, tracks scores and standings live, and lets
              players follow along from a shared link or QR scan.
            </p>
          </div>

          <Button asChild className="h-12 w-full text-base font-semibold sm:w-auto">
            <Link to="/new">
              <Plus size={18} />
              New tournament
            </Link>
          </Button>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Recent rooms</h2>
            {recentRooms.length > 0 ? (
              <Button onClick={onClear} size="sm" variant="ghost">
                <Trash2 size={15} />
                Clear
              </Button>
            ) : null}
          </div>

          {recentRooms.length === 0 ? (
            <Card>
              <CardContent className="text-sm text-muted-foreground">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
                  <RotateCcw size={18} />
                </div>
                Recent rooms will appear here after you open them.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {recentRooms.map((room) => (
                <Link
                  className="block rounded-xl outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
                  key={room.code}
                  to={room.status === "finished" ? `/t/${room.code}/done` : `/t/${room.code}`}
                >
                  <Card className="transition hover:ring-primary/50">
                    <CardContent>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{room.name}</div>
                          <MetadataLine className="mt-1 text-sm" items={recentRoomMetadata(room)} />
                        </div>
                        <Badge
                          className={cn(
                            "capitalize",
                            room.status === "active"
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                          variant="outline"
                        >
                          {room.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-dashed bg-card/50 p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
              <QrCode size={18} />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-sm font-semibold text-foreground">Joining a room?</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Scan the QR on the organizer&apos;s screen or open the URL they share with you.
              </p>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Link2 size={14} />
                Shared links open the room directly.
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function recentRoomMetadata(room: RecentRoom): string[] {
  return [
    formatShortTournamentDate(room.date),
    room.mode ? displayMode(room.mode) : null,
    room.playerCount !== undefined ? `${room.playerCount} players` : null,
  ].filter((item): item is string => Boolean(item));
}
