import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LuCheck } from "react-icons/lu";
import { cn, focusRing } from "./cn";

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  active: boolean;
  children: ReactNode;
};

/** A toggle pill for filters and multi-select; shows a check when active. */
export function Chip({ active, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-all active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-9",
        focusRing,
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-foreground hover:bg-muted",
        className,
      )}
      {...rest}
    >
      {active && <LuCheck className="h-3.5 w-3.5" aria-hidden />}
      {children}
    </button>
  );
}
