import type { ReactNode } from "react";
import type { PostStatus, TargetStatus } from "../../lib/api/types";
import { cn } from "./cn";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "destructive";

const VARIANTS: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function Badge({ variant = "secondary", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        VARIANTS[variant],
      )}
    >
      {children}
    </span>
  );
}

const STATUS: Record<PostStatus | TargetStatus, BadgeVariant> = {
  draft: "secondary",
  scheduled: "default",
  publishing: "warning",
  processing: "warning",
  published: "success",
  partially_published: "warning",
  failed: "destructive",
};

export function StatusBadge({ status }: { status: PostStatus | TargetStatus }) {
  const label = status.replace("_", " ");
  return <Badge variant={STATUS[status]}>{label[0].toUpperCase() + label.slice(1)}</Badge>;
}
