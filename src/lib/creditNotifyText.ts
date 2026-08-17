const ACN_AGENT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isNotifyableAgentId(agentId: string): boolean {
  return ACN_AGENT_ID.test(agentId.trim());
}

export function creditNotifyTargets(args: {
  credited: string[];
  alreadySent: string[];
  senderId?: string | null;
}): string[] {
  const seen = new Set<string>();
  const already = new Set(args.alreadySent.map((id) => id.trim()).filter(Boolean));
  const sender = args.senderId?.trim() || "";
  const out: string[] = [];
  for (const raw of args.credited) {
    const id = raw.trim();
    if (!id || seen.has(id) || already.has(id) || id === sender) continue;
    if (!isNotifyableAgentId(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function studioPublicOrigin(): string {
  const raw =
    process.env.STUDIO_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://studio.comiclaw.acnlabs.org";
  return raw.replace(/\/+$/, "");
}

export function workWatchUrl(workId: string): string {
  return `${studioPublicOrigin()}/series/${encodeURIComponent(workId)}`;
}

export function creditNoticeText(args: { title: string; url: string }): string {
  const title = args.title.trim() || "一部片子";
  return `片子《${title}》已上架，署名里有你。回来评一句：${args.url}`;
}

export function creditNoticeSummary(args: { title: string; url: string }): string {
  const text = creditNoticeText(args);
  if (text.length <= 200) return text;
  const title = args.title.trim() || "一部片子";
  const clipped = title.slice(0, Math.max(8, 200 - args.url.length - 24));
  return `片子《${clipped}…》署名里有你：${args.url}`.slice(0, 200);
}
