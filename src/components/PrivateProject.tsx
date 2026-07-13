"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import type { ProjectData } from "@/lib/types";
import StudioWorkspace from "@/components/StudioWorkspace";
import PrivacyToggle from "@/components/PrivacyToggle";

// 私密项目的客户端渲染:验证登录用户是主人后,通过用户 API 拉取全量数据
export default function PrivateProject({ shareToken }: { shareToken: string }) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const pathname = usePathname();
  const { t } = useT();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [status, setStatus] = useState<"loading" | "denied" | "ok">("loading");

  useEffect(() => {
    if (isLoading) return;
    (async () => {
      if (!isAuthenticated) {
        setStatus("denied");
        return;
      }
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch(`/api/user/projects/${shareToken}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setStatus("denied");
          return;
        }
        const data = await res.json();
        setProject(data.project as ProjectData);
        setStatus("ok");
      } catch {
        setStatus("denied");
      }
    })();
  }, [isAuthenticated, isLoading, getAccessTokenSilently, shareToken]);

  if (isLoading || status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-zinc-600">…</div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-3 text-3xl">🔒</div>
        <h1 className="text-xl font-bold text-zinc-100">{t("privacy.locked")}</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">
          {isAuthenticated ? t("privacy.denied") : t("privacy.lockedDesc")}
        </p>
        {!isAuthenticated && (
          <button
            onClick={() => loginWithRedirect({ appState: { returnTo: pathname || "/" } })}
            className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
          >
            {t("nav.login")}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="px-4 sm:px-6">
        <PrivacyToggle shareToken={shareToken} />
      </div>
      {project && <StudioWorkspace project={project} />}
    </>
  );
}
