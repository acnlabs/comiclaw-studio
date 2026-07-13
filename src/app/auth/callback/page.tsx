"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";

// Auth0 登录回调页:SDK 在 Provider 层完成 code 交换,
// 这里只处理超时兜底(正常情况 onRedirectCallback 已跳转)。
export default function AuthCallbackPage() {
  const router = useRouter();
  const { isLoading, error } = useAuth0();

  useEffect(() => {
    if (error) {
      console.error("[auth] callback error:", error);
      router.replace("/");
    }
    const timer = setTimeout(() => {
      if (!isLoading) router.replace("/");
    }, 4000);
    return () => clearTimeout(timer);
  }, [isLoading, error, router]);

  return (
    <div className="flex flex-1 items-center justify-center py-24 text-sm text-zinc-500">
      Signing in…
    </div>
  );
}
