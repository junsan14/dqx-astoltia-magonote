import Link from "next/link";

const NotFoundPage = () => {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-indigo-50 to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-120px] h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/20" />
        <div className="absolute bottom-[-80px] right-[8%] h-[220px] w-[220px] rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute left-[8%] top-[28%] h-[180px] w-[180px] rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-500/10" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full max-w-2xl rounded-[32px] border border-white/60 bg-white/75 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_20px_60px_rgba(2,6,23,0.45)] sm:p-10">
          <div className="mb-6 inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-extrabold tracking-[0.18em] text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-300">
            DQX TOOLS
          </div>

          <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
            <div className="flex items-center gap-4 sm:block">
              <div className="text-6xl font-black leading-none tracking-[-0.08em] text-slate-900 dark:text-white sm:text-8xl">
                404
              </div>
              <div className="hidden h-20 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
            </div>

            <div>
              <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-white sm:text-5xl">
                ページが見つかりません
              </h1>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.22)] dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                  トップへ戻る
                </Link>

                <Link
                  href="/tools/monster-search"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900/70"
                >
                  モンスター検索へ
                </Link>
              </div>
            </div>
          </div>


        </section>
      </div>
    </main>
  );
};

export default NotFoundPage;