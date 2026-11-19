import { cn } from "../ui/cn";

/** One placeholder block; compose these to mirror the real layout. */
export function Bone({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)} />;
}
