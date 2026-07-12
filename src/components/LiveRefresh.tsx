"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 订阅项目 SSE,收到更新事件后刷新服务端数据
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
    return () => es.close();
  }, [token, router]);

  return null;
}
