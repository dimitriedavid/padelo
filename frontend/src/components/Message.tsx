import type { ReactNode } from "react";

import { cn } from "../lib/cn";

type MessageProps = {
  tone?: "error" | "info" | "success";
  children: ReactNode;
};

export function Message({ tone = "info", children }: MessageProps) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error" && "border-red-200 bg-red-50 text-red-800",
        tone === "info" && "border-line bg-white text-slate-700",
        tone === "success" && "border-court-100 bg-court-50 text-court-700",
      )}
    >
      {children}
    </div>
  );
}

