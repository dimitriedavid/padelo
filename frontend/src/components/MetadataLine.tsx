import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type MetadataLineProps = {
  items: string[];
  className?: string;
};

export function MetadataLine({ items, className }: MetadataLineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [hiddenSeparators, setHiddenSeparators] = useState<boolean[]>([]);

  const updateSeparators = useCallback(() => {
    const next = items.map((_, index) => {
      if (index === 0) {
        return true;
      }

      const item = itemRefs.current[index];
      const previousItem = itemRefs.current[index - 1];

      return Boolean(item && previousItem && item.offsetTop !== previousItem.offsetTop);
    });

    setHiddenSeparators((current) => {
      if (current.length === next.length && current.every((value, index) => value === next[index])) {
        return current;
      }

      return next;
    });
  }, [items]);

  useLayoutEffect(() => {
    updateSeparators();

    const container = containerRef.current;
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateSeparators);

    if (container) {
      resizeObserver?.observe(container);
    }

    window.addEventListener("resize", updateSeparators);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateSeparators);
    };
  }, [updateSeparators]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div aria-label={items.join(", ")} className={cn("text-muted-foreground", className)} ref={containerRef}>
      <div className="flex flex-wrap items-center gap-y-1">
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="inline-flex items-center whitespace-nowrap"
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
          >
            {index > 0 && !hiddenSeparators[index] ? (
              <span aria-hidden="true" className="mx-2 text-muted-foreground/60">
                ·
              </span>
            ) : null}
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
