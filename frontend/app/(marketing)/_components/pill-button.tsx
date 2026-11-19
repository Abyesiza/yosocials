import Link from "next/link";
import type { ComponentProps } from "react";
import { cn, focusRing } from "@/app/components/ui";

const VARIANTS = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:opacity-95",
  light: "bg-white text-zinc-900 hover:bg-white/90",
  ghost: "border border-white/20 text-white hover:bg-white/10",
  outline: "border border-border text-foreground hover:bg-muted",
} as const;

export function PillButton({
  variant = "primary",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: keyof typeof VARIANTS }) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-all hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none",
        focusRing,
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}
