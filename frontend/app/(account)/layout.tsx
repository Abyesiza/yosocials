import Image from "next/image";
import Link from "next/link";
import { ProfileMenu } from "@/app/components/profile-menu";

export default function AccountLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={500} height={500} className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight text-foreground">Yo Socials</span>
        </Link>
        <ProfileMenu />
      </header>
      <main className="flex-1 px-4 py-8 md:px-8 xl:px-10">{children}</main>
    </div>
  );
}
