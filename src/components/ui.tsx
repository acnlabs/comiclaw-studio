"use client";

import { useEffect, useState, type ReactElement } from "react";
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

export type VersionPillItem = {
  id: string;
  label: string;
};

/** Number-keyed pills (per-asset takes) or id-keyed pills (multi-author scripts/films). */
export function VersionPills(props: {
  versions: number[];
  selected: number;
  onSelect: (v: number) => void;
}): ReactElement | null;
export function VersionPills(props: {
  versions: VersionPillItem[];
  selected: string;
  onSelect: (v: string) => void;
}): ReactElement | null;
export function VersionPills({
  versions,
  selected,
  onSelect,
}: {
  versions: number[] | VersionPillItem[];
  selected: number | string;
  onSelect: (v: never) => void;
}) {
  const { t } = useT();
  const numeric = typeof versions[0] === "number";
  const items: VersionPillItem[] = versions.map((v) =>
    typeof v === "number" ? { id: String(v), label: `V${v}` } : v
  );
  if (items.length <= 1) return null;
  const selectedId = String(selected);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-zinc-500">{t("common.version")}</span>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            if (numeric) {
              (onSelect as (v: number) => void)(Number(item.id));
            } else {
              (onSelect as (v: string) => void)(item.id);
            }
          }}
          aria-pressed={item.id === selectedId}
          aria-label={item.label}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            item.id === selectedId
              ? "bg-accent text-zinc-950"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          {item.label}
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

// 长文本折叠(人设/简介等),默认收起,点击展开全文
export function CollapsibleText({ text }: { text: string }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 160 || text.split("\n").length > 4;

  return (
    <div>
      <p
        className={`whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 ${
          isLong && !expanded ? "line-clamp-4" : ""
        }`}
      >
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-accent transition-opacity hover:opacity-80"
        >
          {expanded ? t("shot.collapse") : t("shot.expand")}
        </button>
      )}
    </div>
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
