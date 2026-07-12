import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <div className="text-xs tracking-widest text-accent">COMICLAW STUDIO</div>
      <h1 className="mt-4 text-2xl font-bold text-zinc-50">页面不存在</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        链接可能有误或项目已被移除。请核对 comiclaw 发给你的专属项目链接。
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
      >
        返回首页
      </Link>
    </div>
  );
}
