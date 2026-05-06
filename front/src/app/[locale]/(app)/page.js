import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createBaseMetadata } from "@/lib/metadata";
import {
  FaHammer,
  FaCoins,
  FaMapLocationDot,
  FaChevronRight,
  FaShieldHalved,
  FaGem,
  FaBookOpen,
} from "react-icons/fa6";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HomePage" });

  return createBaseMetadata({
    locale,
    title: t("meta.title"),
    description: t("meta.description"),
    path: `/${locale}`,
  });
}

export default async function HomePage({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HomePage" });

  const tools = [
    {
      key: "craftProfit",
      href: "/tools/craft-profit",
      accent: "from-amber-500 to-orange-500",
      icon: FaHammer,
      soft:
        "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    },
    {
      key: "monsterSearch",
      href: "/tools/monster-search",
      accent: "from-indigo-500 to-cyan-500",
      icon: FaMapLocationDot,
      soft:
        "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
    },
    {
      key: "monsterZukan",
      href: "/tools/monster-zukan",
      accent: "from-emerald-500 to-teal-500",
      icon: FaBookOpen,
      soft:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    },
    {
      key: "mapMonsterBrowser",
      href: "/tools/map-monster-browser",
      accent: "from-fuchsia-500 to-violet-500",
      icon: FaMapLocationDot,
      soft:
        "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
    },
  ];

  const pains = [
    {
      key: "equipmentStats",
      icon: FaShieldHalved,
    },
    {
      key: "costCheck",
      icon: FaCoins,
    },
    {
      key: "reverseLookup",
      icon: FaGem,
    },
  ];

  return (
    <main className="min-h-screen bg-white text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.10),transparent_28%),linear-gradient(to_bottom,#ffffff,#f8fafc)] dark:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_28%),linear-gradient(to_bottom,#020617,#0f172a)]" />
        <div className="absolute -left-10 top-16 h-56 w-56 rounded-full bg-indigo-100 blur-3xl dark:bg-indigo-500/10" />
        <div className="absolute right-0 top-24 h-64 w-64 rounded-full bg-cyan-100 blur-3xl dark:bg-cyan-500/10" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-4xl">
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              {t("hero.titleLine1")}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-300 dark:to-cyan-300">
                {t("hero.titleHighlight")}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
              {t("hero.description")}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {t("pains.heading")}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pains.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.key}
                className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:shadow-none dark:hover:border-slate-700"
              >
                <div className="mb-4 h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 dark:from-indigo-400 dark:to-cyan-300" />

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <Icon className="text-lg" />
                </div>

                <p className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
                  {t(`pains.items.${item.key}.title`)}
                </p>

                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {t(`pains.items.${item.key}.text`)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {t("tools.heading")}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-none dark:hover:border-slate-700"
              >
                <div
                  className={`mb-6 h-2 w-24 rounded-full bg-gradient-to-r ${tool.accent}`}
                />

                <div className="flex items-start justify-between gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tool.soft}`}
                  >
                    <Icon className="text-xl" />
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {t(`tools.items.${tool.key}.badge`)}
                  </span>
                </div>

                <div className="mt-5">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {t(`tools.items.${tool.key}.title`)}
                  </h3>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                    {t(`tools.items.${tool.key}.description`)}
                  </p>
                </div>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                  {t("tools.open")}
                  <FaChevronRight className="transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}