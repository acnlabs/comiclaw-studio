"use client";

import { useEffect, useState } from "react";

export default function CopyOrgButton({
  orgId,
  copyLabel,
  copiedLabel,
}: {
  orgId: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(orgId);
      setCopied(true);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="text-xs font-medium text-accent underline-offset-4 hover:underline"
    >
      {copied ? copiedLabel : copyLabel}
    </button>
  );
}
