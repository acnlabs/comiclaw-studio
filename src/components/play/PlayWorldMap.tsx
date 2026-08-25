"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;
const CELL = 104;
const GAP = 8;
/** Surface beyond the first ring so pan/zoom has room to move. */
const EXTENT = 2;
const FIRST_RING = 1;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function cellsAt(reach: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = reach; y >= -reach; y--) {
    for (let x = -reach; x <= reach; x++) {
      out.push({ x, y });
    }
  }
  return out;
}

export type MapPlot = { id?: string; x: number; y: number; name?: string | null };

function surfaceSize(grid: number) {
  return grid * CELL + (grid - 1) * GAP;
}

export default function PlayWorldMap({
  plots,
  nextPlot,
  highlightPlot = null,
}: {
  plots: MapPlot[];
  nextPlot: MapPlot;
  highlightPlot?: MapPlot | null;
}) {
  const reach = Math.max(
    EXTENT,
    ...plots.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))),
    Math.max(Math.abs(nextPlot.x), Math.abs(nextPlot.y)),
  );
  const grid = reach * 2 + 1;
  const tiles = cellsAt(reach);
  const claimed = new Map<string, MapPlot>(
    plots.map((p) => [`${p.x},${p.y}`, p]),
  );
  const { t } = useT();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  );

  const zoomAt = useCallback((next: number, originX: number, originY: number) => {
    const clamped = clamp(next, MIN_SCALE, MAX_SCALE);
    setScale((prevScale) => {
      const ratio = clamped / prevScale;
      setPan((prevPan) => ({
        x: originX - (originX - prevPan.x) * ratio,
        y: originY - (originY - prevPan.y) * ratio,
      }));
      return clamped;
    });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ox = e.clientX - rect.left - rect.width / 2;
      const oy = e.clientY - rect.top - rect.height / 2;
      const dir = e.deltaY < 0 ? 1 : -1;
      setScale((prev) => {
        const next = clamp(prev + dir * SCALE_STEP, MIN_SCALE, MAX_SCALE);
        const ratio = next / prev;
        setPan((p) => ({
          x: ox - (ox - p.x) * ratio,
          y: oy - (oy - p.y) * ratio,
        }));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPan({
      x: drag.current.panX + (e.clientX - drag.current.x),
      y: drag.current.panY + (e.clientY - drag.current.y),
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      drag.current = null;
      setDragging(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const recenter = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="mt-4">
      <p className="max-w-xl text-sm text-zinc-500">{t("play.mapHint")}</p>
      <p className="mt-1 text-xs text-zinc-600">{t("play.mapPanHint")}</p>

      <div
        ref={viewportRef}
        className="relative mt-4 h-[28rem] touch-none overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 select-none"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: surfaceSize(grid),
            height: surfaceSize(grid),
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${grid}, ${CELL}px)`,
              gap: GAP,
            }}
          >
            {tiles.map(({ x, y }) => {
              const key = `${x},${y}`;
              const plot = claimed.get(key);
              const isClaimed = Boolean(plot);
              const isNext = nextPlot.x === x && nextPlot.y === y && !isClaimed;
              const isHighlight =
                highlightPlot?.x === x && highlightPlot?.y === y && isClaimed;
              const inner = Math.max(Math.abs(x), Math.abs(y)) <= FIRST_RING;
              const showLabel = inner || isClaimed || isNext;
              const cellClass = `flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed px-2 text-center ${
                isHighlight
                  ? "border-accent bg-accent/25 ring-2 ring-accent/60"
                  : isClaimed
                    ? "border-accent/70 bg-accent/15"
                    : isNext
                      ? "border-accent/50 bg-accent/5"
                      : inner
                        ? "border-zinc-800 bg-zinc-900/40"
                        : "border-zinc-900 bg-zinc-950/80"
              }`;
              const label = (
                <>
                  <span className="font-mono text-xs text-zinc-400">
                    ({x}, {y})
                  </span>
                  <span className="mt-1 text-[11px] leading-snug text-zinc-600">
                    {isClaimed
                      ? plot?.name?.trim() || t("play.plotClaimed")
                      : isNext
                        ? t("play.plotNext")
                        : t("play.mapEmptyCell")}
                  </span>
                </>
              );

              if (isClaimed && plot) {
                return (
                  <Link
                    key={key}
                    href={`/play/plot/${plot.id}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`${cellClass} hover:border-accent`}
                  >
                    {showLabel ? label : null}
                  </Link>
                );
              }

              return (
                <div key={key} className={cellClass}>
                  {showLabel ? label : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-lg">
          <MapControl
            label={t("play.mapZoomIn")}
            onClick={() => zoomAt(scale + SCALE_STEP, 0, 0)}
            disabled={scale >= MAX_SCALE}
          >
            +
          </MapControl>
          <MapControl
            label={t("play.mapZoomOut")}
            onClick={() => zoomAt(scale - SCALE_STEP, 0, 0)}
            disabled={scale <= MIN_SCALE}
          >
            −
          </MapControl>
          <MapControl label={t("play.mapReset")} onClick={recenter}>
            ⌂
          </MapControl>
        </div>
      </div>
    </div>
  );
}

function MapControl({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex h-9 w-9 items-center justify-center text-base text-zinc-200 hover:bg-zinc-800 disabled:text-zinc-600"
    >
      {children}
    </button>
  );
}
