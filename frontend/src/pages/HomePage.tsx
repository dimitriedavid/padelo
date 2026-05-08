import { Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "../components/PageShell";
import { DEFAULT_SEO_DESCRIPTION, DEFAULT_SEO_TITLE, Seo } from "../components/Seo";
import { clearRecentRooms, getRecentRooms } from "../lib/recentRooms";
import { normalizeRoomInput } from "../lib/tournament";
import type { RecentRoom } from "../lib/types";

export function HomePage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);

  useEffect(() => {
    setRecentRooms(getRecentRooms());
  }, []);

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeRoomInput(roomCode);

    if (normalized) {
      navigate(`/t/${normalized}`);
    }
  };

  const onClear = () => {
    clearRecentRooms();
    setRecentRooms([]);
  };

  return (
    <PageShell
      actions={
        <Button asChild className="hidden sm:inline-flex">
          <Link to="/new">
            <Plus size={17} />
            New
          </Link>
        </Button>
      }
    >
      <Seo
        description={DEFAULT_SEO_DESCRIPTION}
        path="/"
        structuredData="webApplication"
        title={DEFAULT_SEO_TITLE}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">Tournament rooms</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Create a room, open a saved room, or enter a code from another player.
            </p>
          </div>

          <Card>
            <CardContent>
              <form className="space-y-2" onSubmit={onJoin}>
                <Label htmlFor="room-code">Room code</Label>
                <div className="flex gap-2">
                  <Input
                    autoCapitalize="characters"
                    className="h-11 uppercase"
                    id="room-code"
                    inputMode="text"
                    onChange={(event) => setRoomCode(event.target.value)}
                    placeholder="ABC123"
                    value={roomCode}
                  />
                  <Button className="h-11" type="submit">
                    <Search size={17} />
                    Open
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Button asChild className="h-12 w-full sm:hidden">
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
                          <div className="mt-1 text-sm text-muted-foreground">{room.code}</div>
                        </div>
                        <Badge className="capitalize" variant="secondary">
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
      </div>
    </PageShell>
  );
}
