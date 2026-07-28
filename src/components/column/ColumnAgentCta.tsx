"use client";

import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { usePathname } from "next/navigation";
import { CHAT_OPEN_EVENT } from "@/components/ChatWidget";

const OPEN_CHAT_FLAG = "comiclaw_column_open_chat";

export default function ColumnAgentCta({
  label,
  returnPath,
}: {
  label: string;
  returnPath: string;
}) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const opened = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || opened.current) return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("openChat") === "1";
    const fromStorage = sessionStorage.getItem(OPEN_CHAT_FLAG) === "1";
    if (!fromQuery && !fromStorage) return;

    opened.current = true;
    sessionStorage.removeItem(OPEN_CHAT_FLAG);
    window.dispatchEvent(new Event(CHAT_OPEN_EVENT));

    if (fromQuery) {
      params.delete("openChat");
      const q = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`
      );
    }
  }, [isAuthenticated, isLoading]);

  function onClick() {
    if (isAuthenticated) {
      window.dispatchEvent(new Event(CHAT_OPEN_EVENT));
      return;
    }
    const path = pathname || returnPath;
    sessionStorage.setItem(OPEN_CHAT_FLAG, "1");
    void loginWithRedirect({
      appState: { returnTo: `${path}${path.includes("?") ? "&" : "?"}openChat=1` },
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-md border border-zinc-500/60 bg-zinc-950/30 px-5 py-2.5 text-sm font-medium text-zinc-100 backdrop-blur transition hover:border-accent/50 hover:text-accent"
    >
      {label}
    </button>
  );
}
