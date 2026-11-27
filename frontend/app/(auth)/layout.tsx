import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative w-full max-w-sm rounded-lg border border-border bg-card px-8 py-10 shadow-sm">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="" width={500} height={500} className="h-14 w-14" priority />
          <span className="text-2xl font-bold tracking-tight text-foreground">Aby Socials</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
