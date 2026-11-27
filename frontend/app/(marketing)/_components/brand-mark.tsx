import Image from "next/image";
import Link from "next/link";
import { cn, focusRing } from "@/app/components/ui";
import { SITE } from "@/app/lib/site";

export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 rounded-md", focusRing)}>
      <Image src="/logo.png" alt="" width={1024} height={1024} className="h-8 w-8" />
      <span className={cn("text-lg font-bold tracking-tight", inverted ? "text-white" : "text-foreground")}>{SITE.name}</span>
    </Link>
  );
}
