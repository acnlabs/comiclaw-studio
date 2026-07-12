"use client";

// 通用小组件:版本切换、空状态、徽章

export function VersionPills({
  versions,
  selected,
  onSelect,
}: {
  versions: number[];
  selected: number;
  onSelect: (v: number) => void;
}) {
  if (versions.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-zinc-500">版本</span>
      {versions.map((v) => (
        <button
          key={v}
          onClick={() => onSelect(v)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            v === selected
              ? "bg-accent text-zinc-950"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          V{v}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
      <div className="mb-3 text-3xl">🎬</div>
      <p className="text-sm text-zinc-500">{text}</p>
      <p className="mt-1 text-xs text-zinc-600">comiclaw 正在制作中,完成后会自动出现在这里</p>
    </div>
  );
}

export function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "amber" | "green";
}) {
  const tones = {
    zinc: "bg-zinc-800 text-zinc-400",
    amber: "bg-amber-500/15 text-amber-400",
    green: "bg-emerald-500/15 text-emerald-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ShotMedia({
  mediaUrl,
  mediaType,
  alt,
}: {
  mediaUrl: string;
  mediaType: string;
  alt: string;
}) {
  if (mediaType === "VIDEO") {
    return (
      <video
        src={mediaUrl}
        controls
        playsInline
        className="h-full w-full object-cover"
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaUrl} alt={alt} className="h-full w-full object-cover" />;
}
