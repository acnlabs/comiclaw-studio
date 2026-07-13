"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 实时刷新:SSE 即时推送(单实例部署下秒级)+ 30s 轮询兜底(Serverless 环境)。
// SSE 断线时浏览器 EventSource 会自动重连;这里额外记录错误便于排查。
const POLL_INTERVAL_MS = 30_000;

export default function LiveRefresh({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      es = new EventSource(`/api/projects/${token}/events`);
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
      es.onerror = () => {
        // EventSource 会自动重连;若连接彻底关闭则手动重建
        if (es && es.readyState === EventSource.CLOSED && !closed) {
          es.close();
          setTimeout(connect, 3000);
        }
      };
    };

    connect();
    const poll = setInterval(() => router.refresh(), POLL_INTERVAL_MS);

    return () => {
      closed = true;
      es?.close();
      clearInterval(poll);
    };
  }, [token, router]);

  return null;
}
