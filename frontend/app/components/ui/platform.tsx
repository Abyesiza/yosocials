import { platforms, type PlatformKey } from "../../lib/platforms";

// Black brand marks (X, TikTok, Threads) would vanish on dark surfaces.
export const isNearBlack = (hex: string) =>
  [1, 3, 5].every((i) => parseInt(hex.slice(i, i + 2), 16) < 0x30);

export function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const info = platforms[platform as PlatformKey];
  if (!info) return null;
  const { Icon, label, color } = info;
  return (
    <Icon
      title={label}
      className={isNearBlack(color) ? "text-foreground" : undefined}
      style={{ width: size, height: size, color: isNearBlack(color) ? undefined : color }}
    />
  );
}

export const platformLabel = (platform: string): string =>
  platforms[platform as PlatformKey]?.label ?? platform;
