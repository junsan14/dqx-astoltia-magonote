export default function MapMonsterBrowserSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <FilterPanelSkeleton />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside>
          <SidebarSkeleton />
        </aside>

        <div className="min-w-0 space-y-6">
          <LayerSectionSkeleton />
          <LayerSectionSkeleton />
        </div>
      </div>
    </div>
  );
}

function FilterPanelSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <div className="h-4 w-20 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
          <div className="h-11 w-full rounded-xl bg-slate-200 animate-pulse dark:bg-slate-800" />
        </div>

        <div className="space-y-2 xl:col-span-2">
          <div className="h-4 w-24 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
          <div className="h-11 w-full rounded-xl bg-slate-200 animate-pulse dark:bg-slate-800" />
        </div>

        <div className="space-y-2">
          <div className="h-4 w-20 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
          <div className="h-11 w-full rounded-xl bg-slate-200 animate-pulse dark:bg-slate-800" />
        </div>
      </div>
    </section>
  );
}

function SidebarSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-5 p-4">
        <div className="space-y-2">
          <div className="h-4 w-20 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
          <div className="h-7 w-40 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
          <div className="h-4 w-48 rounded-full bg-slate-200/80 animate-pulse dark:bg-slate-800/80" />
        </div>

        <div className="space-y-3">
          <div className="h-4 w-32 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 h-9 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-9 rounded-full bg-slate-100 animate-pulse dark:bg-slate-800/80"
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-4 w-28 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-20 rounded-full bg-slate-100 animate-pulse dark:bg-slate-800/80"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LayerSectionSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="h-5 w-32 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
        <div className="mt-2 h-4 w-40 rounded-full bg-slate-200/80 animate-pulse dark:bg-slate-800/80" />
      </div>

      <div className="p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,410px)_minmax(0,1fr)] xl:items-center">
          <div className="min-w-0 xl:max-w-[410px]">
            <div className="aspect-[4/3] w-full rounded-2xl bg-slate-100 animate-pulse dark:bg-slate-800/80" />
          </div>

          <div className="min-w-0 overflow-hidden">
            <div className="mb-2 flex justify-end">
              <div className="h-8 w-24 rounded-full bg-slate-100 animate-pulse dark:bg-slate-800/80" />
            </div>

            <div className="hidden xl:flex gap-4 overflow-hidden pb-2 pr-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[320px] min-w-[320px] max-w-[320px] shrink-0 rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <SpawnCardSkeleton />
                </div>
              ))}
            </div>

            <div className="xl:hidden">
              <div className="mb-2 flex justify-end">
                <div className="h-8 w-24 rounded-full bg-slate-100 animate-pulse dark:bg-slate-800/80" />
              </div>

              <div className="flex gap-3 overflow-hidden">
                <div className="w-full min-w-full max-w-full rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <SpawnCardSkeleton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpawnCardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-6 w-32 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
          <div className="h-6 w-16 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
          <div className="h-6 w-12 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
        </div>

        <div className="h-8 w-20 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/70"
          >
            <div className="h-3 w-14 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
            <div className="mt-2 h-4 w-12 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800/70">
        <div className="h-4 w-20 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-14 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700"
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-4 w-16 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
        <div className="h-16 rounded-2xl bg-slate-100 animate-pulse dark:bg-slate-800/70" />
      </div>
    </div>
  );
}