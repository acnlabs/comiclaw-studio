"use client";

import CopyTextButton from "@/components/column/CopyTextButton";

export default function SkillInstall({
  command,
  installLabel,
  copyLabel,
  copiedLabel,
}: {
  command: string;
  installLabel: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-zinc-100">{installLabel}</h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
        <code className="min-w-0 flex-1 break-all font-mono text-sm text-zinc-200">
          {command}
        </code>
        <CopyTextButton
          text={command}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
      </div>
    </section>
  );
}
