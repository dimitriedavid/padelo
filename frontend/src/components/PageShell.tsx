import { Link } from "react-router-dom";

import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  actions?: ReactNode;
};

export function PageShell({ children, actions }: PageShellProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-card/92 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <Link className="flex min-w-0 items-center gap-2 text-foreground" to="/">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              P
            </span>
            <span className="truncate font-display text-lg font-semibold">Padelo</span>
          </Link>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
