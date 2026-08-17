"use client";

import Link from "next/link";
import { authorLine } from "@/lib/authorLine";

export default function AuthorCredit({
  handle,
  authorName,
  href,
  className,
}: {
  handle?: string | null;
  authorName?: string | null;
  href?: string | null;
  className?: string;
}) {
  const line = authorLine({ handle, authorName });
  if (!line) return null;
  if (href) {
    return (
      <Link href={href} className={className}>
        {line}
      </Link>
    );
  }
  return <span className={className}>{line}</span>;
}
