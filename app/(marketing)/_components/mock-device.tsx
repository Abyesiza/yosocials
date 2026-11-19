import Image from "next/image";
import { cn } from "@/app/components/ui";

type MockDeviceProps = {
  kind: "browser" | "phone";
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
};

// Pixel sizes of the captured screenshots, so layout never shifts.
const SIZE = { browser: { width: 2880, height: 1800 }, phone: { width: 1419, height: 2796 } };

export function MockDevice({ kind, src, alt, priority, sizes, className }: MockDeviceProps) {
  const { width, height } = SIZE[kind];
  if (kind === "phone") {
    return (
      <div className={cn("relative z-10 w-full max-w-[260px] drop-shadow-2xl lg:max-w-[300px]", className)}>
        <div className="overflow-hidden rounded-[2.5rem] border-[10px] border-zinc-900 bg-zinc-900">
          <Image src={src} alt={alt} width={width} height={height} priority={priority} sizes={sizes ?? "300px"} className="h-auto w-full rounded-[1.75rem]" />
        </div>
      </div>
    );
  }
  return (
    <div className={cn("relative z-10 w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-900 drop-shadow-2xl", className)}>
      <div aria-hidden className="flex h-8 items-center gap-1.5 border-b border-white/10 px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-red" />
        <span className="h-2.5 w-2.5 rounded-full bg-brand-yellow" />
        <span className="h-2.5 w-2.5 rounded-full bg-brand-green" />
        <span className="ml-3 h-4 w-48 rounded-sm bg-white/10" />
      </div>
      <Image src={src} alt={alt} width={width} height={height} priority={priority} sizes={sizes ?? "(min-width: 1024px) 60vw, 100vw"} className="aspect-[16/10] h-auto w-full" />
    </div>
  );
}
