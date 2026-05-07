import { Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { PageShell } from "../components/PageShell";
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
        <Link
          className="hidden h-11 items-center justify-center gap-2 rounded-md bg-court-600 px-4 text-sm font-medium text-white transition hover:bg-court-700 sm:inline-flex"
          to="/new"
        >
          <Plus size={17} />
          New
        </Link>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-normal text-ink sm:text-3xl">Tournament rooms</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Create a room, open a saved room, or enter a code from another player.
            </p>
          </div>

          <form className="panel p-4 sm:p-5" onSubmit={onJoin}>
            <label className="space-y-2">
              <span className="field-label">Room code</span>
              <div className="flex gap-2">
                <input
                  autoCapitalize="characters"
                  className="field-input uppercase"
                  inputMode="text"
                  onChange={(event) => setRoomCode(event.target.value)}
                  placeholder="ABC123"
                  value={roomCode}
                />
                <Button icon={<Search size={17} />} type="submit">
                  Open
                </Button>
              </div>
            </label>
          </form>

          <Link
            className="flex h-12 items-center justify-center gap-2 rounded-md bg-court-600 px-4 text-sm font-medium text-white shadow-soft sm:hidden"
            to="/new"
          >
            <Plus size={18} />
            New tournament
          </Link>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Recent rooms</h2>
            {recentRooms.length > 0 ? (
              <Button icon={<Trash2 size={15} />} onClick={onClear} size="sm" variant="ghost">
                Clear
              </Button>
            ) : null}
          </div>

          {recentRooms.length === 0 ? (
            <div className="panel p-5 text-sm text-slate-600">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-md bg-court-50 text-court-700">
                <RotateCcw size={18} />
              </div>
              Recent rooms will appear here after you open them.
            </div>
          ) : (
            <div className="grid gap-2">
              {recentRooms.map((room) => (
                <Link
                  className="panel block p-4 transition hover:border-court-500"
                  key={room.code}
                  to={room.status === "finished" ? `/t/${room.code}/done` : `/t/${room.code}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{room.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{room.code}</div>
                    </div>
                    <span className="rounded bg-court-50 px-2 py-1 text-xs font-medium capitalize text-court-700">
                      {room.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
