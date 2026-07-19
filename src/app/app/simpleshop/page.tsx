import Link from "next/link";
import { SIMPLESHOP_MODULES } from "@/lib/simpleshop/modules";

export default function SimpleshopHomePage() {
  const primary = Object.entries(SIMPLESHOP_MODULES).filter(([, module]) => module.primary);
  const secondary = Object.entries(SIMPLESHOP_MODULES).filter(([, module]) => !module.primary);

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-semibold text-cyan-400">Native app · Phase 2</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">店務管理首頁</h1>
        <p className="mt-3 max-w-2xl text-slate-400">從日常工作進入，不是行銷頁。所有資料與操作都固定在目前 Organization 範圍內。</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {primary.map(([key, module]) => (
          <Link key={key} href={`/app/simpleshop/${key}`} className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-0.5 hover:border-cyan-500">
            <span className={`block h-2 w-14 rounded-full ${module.accent}`} />
            <h2 className="mt-6 text-xl font-semibold text-white">{module.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{module.description}</p>
            <span className="mt-6 inline-block text-sm font-semibold text-cyan-400 group-hover:text-cyan-300">進入模組 →</span>
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">支援區域</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {secondary.map(([key, module]) => (
            <Link key={key} href={`/app/simpleshop/${key}`} className="rounded-xl border border-slate-800 px-4 py-4 text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-900">
              {module.title}
            </Link>
          ))}
          <Link href="/app/simpleshop/settings" className="rounded-xl border border-slate-800 px-4 py-4 text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-900">店家設定</Link>
        </div>
      </section>
    </div>
  );
}
