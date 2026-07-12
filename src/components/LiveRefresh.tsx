"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 实时刷新:SSE 即时推送(单实例部署下秒级);
// 同时以低频轮询兜底(Serverless 部署下 SSE 跨实例不可达时仍能更新)。
const POLL_INTERVAL_MS = 30_000;

export default function LiveRefresh({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource(`/api/projects/${token}/events`);
    es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.event && payload.event !== "connected") {
          router.refresh();
        }
      } catch {
        // ignore malformed payload
      }
    };

    const poll = setInterval(() => router.refresh(), POLL_INTERVAL_MS);

    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [token, router]);

  return null;
}
