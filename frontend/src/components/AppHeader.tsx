import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { PadeloWordmark } from "./PadeloBrand";

type AppHeaderProps = {
  actions?: ReactNode;
  actionsClassName?: string | undefined;
  className?: string | undefined;
  constrained?: boolean | undefined;
  contentClassName?: string | undefined;
  logoClassName?: string | undefined;
  logoHref?: string | null | undefined;
  sticky?: boolean | undefined;
};

export function AppHeader({
  actions,
  actionsClassName,
  className,
  constrained = true,
  contentClassName,
  logoClassName,
  logoHref = "/",
  sticky = true,
}: AppHeaderProps) {
  const logo = <PadeloWordmark className={cn("text-2xl", logoClassName)} />;
  const logoClass = "flex min-w-0 items-center gap-2 text-foreground";

  return (
    <header className={cn("border-b bg-background/92 backdrop-blur", sticky && "sticky top-0 z-20", className)}>
      <div
        className={cn(
          "mx-auto flex h-14 w-full items-center justify-between gap-3 px-4 sm:h-16 sm:px-6",
          constrained ? "max-w-6xl" : "max-w-none",
          contentClassName,
        )}
      >
        {logoHref ? (
          <Link className={logoClass} to={logoHref}>
            {logo}
          </Link>
        ) : (
          <div className={logoClass}>{logo}</div>
        )}
        {actions ? <div className={cn("ml-auto flex items-center gap-2", actionsClassName)}>{actions}</div> : null}
      </div>
    </header>
  );
}
