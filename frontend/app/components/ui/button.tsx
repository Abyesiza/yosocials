import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import LogoSpinner from "../LogoSpinner";
import { cn, focusRing } from "./cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "destructive-ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground font-semibold shadow-sm hover:opacity-95",
  secondary: "bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80",
  outline: "border border-border bg-transparent text-foreground font-medium hover:bg-muted",
  ghost: "bg-transparent text-foreground font-medium hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground font-semibold shadow-sm hover:opacity-95",
  "destructive-ghost": "bg-transparent text-destructive font-medium hover:bg-destructive/10",
};

// Mobile sizes keep 44px tap targets; desktop tightens.
const SIZES: Record<ButtonSize, string> = {
  sm: "h-11 px-3 text-[13px] sm:h-9",
  md: "h-11 px-4 text-sm sm:h-10",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100",
    focusRing,
    VARIANTS[variant],
    SIZES[size],
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant,
  size,
  loading,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses(variant, size), className)}
      {...rest}
    >
      {loading && <LogoSpinner size={16} label="Working" />}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

/** A link styled as a button, so we never nest a <button> inside an <a>. */
export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <Link className={cn(buttonClasses(variant, size), className)} {...rest} />;
}
