const initialsOf = (name: string) =>
  name
    .replace(/^@/, "")
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

/** Avatar with an optional story-style ring in the logo's colors. */
export function Avatar({
  name,
  src,
  size = 40,
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const inner = (
    <span
      className="flex items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? (
        // Avatars come from many platform CDNs that next/image would each need allowlisted.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
  if (!ring) return inner;
  return (
    <span
      className="inline-flex rounded-full p-[2px]"
      style={{
        background:
          "conic-gradient(var(--brand-yellow), var(--brand-red), var(--brand-green), var(--brand-blue), var(--brand-yellow))",
      }}
    >
      <span className="rounded-full bg-background p-[2px]">{inner}</span>
    </span>
  );
}
