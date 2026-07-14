"use client";

import { useEffect } from "react";
import { useT } from "@/components/LocaleProvider";

// 通用小组件:版本切换、空状态、徽章、详情弹层

export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t("detail.close")}
          title={t("detail.close")}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export function VersionPills({
  versions,
  selected,
  onSelect,
}: {
  versions: number[];
  selected: number;
  onSelect: (v: number) => void;
}) {
  const { t } = useT();
  if (versions.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-zinc-500">{t("common.version")}</span>
      {versions.map((v) => (
        <button
          key={v}
          onClick={() => onSelect(v)}
          aria-pressed={v === selected}
          aria-label={`V${v}`}
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
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
      <div className="mb-3 text-3xl">🎬</div>
      <p className="text-sm text-zinc-500">{text}</p>
      <p className="mt-1 text-xs text-zinc-600">{t("panel.emptyHint")}</p>
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
