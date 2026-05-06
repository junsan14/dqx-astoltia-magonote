export default function CraftProfitSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="space-y-2">
        <div className="h-8 w-40 rounded-xl bg-slate-200/90 dark:bg-slate-800/90 animate-pulse" />
        <div className="h-4 w-64 rounded-full bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
      </header>

      <div className="grid grid-cols-1 gap-5 items-start lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-4 p-5 sm:p-6">
            <div className="h-5 w-28 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />

            <div className="h-12 w-full rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />

            <div className="grid grid-cols-2 gap-3">
              <div className="h-11 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-11 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>

            <div className="space-y-3 pt-1">
              <div className="h-4 w-24 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>

            <div className="space-y-2 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/80 animate-pulse"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-6 w-40 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-4 w-28 rounded-full bg-slate-200/80 dark:bg-slate-800/80 animate-pulse" />
              </div>
              <div className="h-12 w-24 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800"
                >
                  <div className="h-3 w-16 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="mt-3 h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                </div>
              ))}
            </div>

            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 animate-pulse"
                />
              ))}
            </div>

            <div className="rounded-2xl bg-slate-100 p-5 dark:bg-slate-800/70">
              <div className="h-4 w-24 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="mt-4 h-8 w-40 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="mt-3 h-4 w-56 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-20 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>

          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[1.4fr_.8fr_.8fr] items-center gap-3 rounded-2xl border border-slate-100 p-4 dark:border-slate-800"
              >
                <div className="h-5 w-3/4 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-10 w-full rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-5 w-2/3 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800/70"
              >
                <div className="h-4 w-20 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="mt-3 h-7 w-28 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}