"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError(true);
    }
  };

  return (
    <form onSubmit={submit} className="mt-12 max-w-sm space-y-3">
      <label className="block text-sm text-zinc-400">管理员密钥 / Admin key</label>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
        placeholder="ADMIN_KEY"
        autoComplete="current-password"
      />
      {error && <p className="text-xs text-red-400">密钥错误 / Invalid key</p>}
      <button
        type="submit"
        disabled={loading || !key}
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "..." : "登录 / Sign in"}
      </button>
    </form>
  );
}
