import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

type PageShellProps = {
  children: ReactNode;
  actions?: ReactNode;
};

export function PageShell({ children, actions }: PageShellProps) {
  return (
    <div className="min-h-dvh">
      <AppHeader actions={actions} />
      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
