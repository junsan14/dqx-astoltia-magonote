"use client";

import ProgressIntlLink from "@/components/common/ProgressIntlLink";
import ProgressLink from "@/components/common/ProgressLink";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FaXTwitter } from "react-icons/fa6";
import { useAuth } from "@/hooks/auth";
import { mochiy } from "@/app/fonts";
import { isAdminPath } from "@/lib/adminPaths";

function HeaderNavLink({
  href,
  localized = true,
  onClick,
  className,
  children,
  ...props
}) {
  if (localized) {
    return (
      <ProgressIntlLink
        href={href}
        onClick={onClick}
        className={className}
        {...props}
      >
        {children}
      </ProgressIntlLink>
    );
  }

  return (
    <ProgressLink
      href={href}
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </ProgressLink>
  );
}

function LanguageSwitcher({ onNavigate }) {
  const pathname = usePathname();

  const currentLocale = pathname.startsWith("/en")
    ? "en"
    : pathname.startsWith("/ja")
    ? "ja"
    : "ja";

  const normalizedPathname =
    pathname.replace(/^\/(ja|en)(?=\/|$)/, "") || "/";

  const wrapperClass =
    "inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5";

  const itemClass = (active) =>
    [
      "inline-flex min-w-[44px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.12em] transition duration-200",
      active
        ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
    ].join(" ");

  return (
    <div className={wrapperClass} aria-label="Language switcher">
      <ProgressIntlLink
        href={normalizedPathname}
        locale="ja"
        onClick={onNavigate}
        className={itemClass(currentLocale === "ja")}
      >
        JA
      </ProgressIntlLink>

      <ProgressIntlLink
        href={normalizedPathname}
        locale="en"
        onClick={onNavigate}
        className={itemClass(currentLocale === "en")}
      >
        EN
      </ProgressIntlLink>
    </div>
  );
}

const ADMIN_MENUS = [
  {
    href: "/admin/tool-editor/accessories",
    label: "アクセ",
    localized: false,
  },
  {
    href: "/admin/tool-editor/items",
    label: "アイテム",
    localized: false,
  },
  {
    href: "/admin/tool-editor/orbs",
    label: "オーブ",
    localized: false,
  },
  {
    href: "/admin/tool-editor/clystals",
    label: "結晶",
    localized: false,
  },
  {
    href: "/admin/tool-editor/game-jobs",
    label: "職業",
    localized: false,
  },
  {
    href: "/admin/tool-editor/equipments",
    label: "装備",
    localized: false,
  },
  {
    href: "/admin/tool-editor/equipment-types",
    label: "装備職人タイプ",
    localized: false,
  },
  {
    href: "/admin/tool-editor/craft-types",
    label: "職人",
    localized: false,
  },
  {
    href: "/admin/tool-editor/continents",
    label: "大陸",
    localized: false,
  },
  {
    href: "/admin/tool-editor/maps",
    label: "マップ",
    localized: false,
  },
  {
    href: "/admin/tool-editor/monsters",
    label: "モンスター",
    localized: false,
  },
  {
    href: "/admin/tool-editor/bosses",
    label: "ボス",
    localized: false,
  },
  {
    href: "/admin/kishoju",
    label: "輝晶獣",
    localized: false,
  },
].sort((a, b) => a.label.localeCompare(b.label, "ja"));

export default function Header() {
  const t = useTranslations("Header");
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const headerRef = useRef(null);

  const term = "v8.0対応";
  const showAdminArea = isAdminPath(pathname);

  const publicMenus = useMemo(
    () => [
      {
        href: "/tools/craft-profit",
        label: t("menus.public.craftProfit"),
        localized: true,
      },
      {
        href: "/tools/monster-search",
        label: t("menus.public.monsterSearch"),
        localized: true,
      },
      {
        href: "/tools/monster-zukan",
        label: t("menus.public.monsterZukan"),
        localized: true,
      },
      {
        href: "/tools/map-monster-browser",
        label: t("menus.public.mapMonsterBrowser"),
        localized: true,
      },
      {
        href: "/tools/accessory-guide",
        label: t("menus.public.accessory-guide"),
        localized: true,
      },
      {
        href: "/tools/kishoju",
        label: t("menus.public.kishoju"),
        localized: true,
      },
    ],
    [t]
  );

  useEffect(() => {
    const updateHeaderHeight = () => {
      const nextHeight = headerRef.current?.offsetHeight ?? 0;
      setHeaderHeight(nextHeight);

      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty(
          "--site-header-height",
          `${nextHeight}px`
        );
      }
    };

    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, []);

  useEffect(() => {
    const handleOpenHeaderMenu = () => {
      setMenuVisible(true);
      window.requestAnimationFrame(() => {
        setOpen(true);
      });
    };

    window.addEventListener("open-header-menu", handleOpenHeaderMenu);

    return () => {
      window.removeEventListener("open-header-menu", handleOpenHeaderMenu);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setMenuVisible(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setMenuVisible(false);
    }, 240);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function closeMenu() {
    setOpen(false);
  }

  function openMenu() {
    setMenuVisible(true);
    window.requestAnimationFrame(() => {
      setOpen(true);
    });
  }

  function toggleMenu() {
    if (open) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  return (
    <>
      <header
        ref={headerRef}
        className={`sticky top-0 z-50 border-b border-slate-200/70 bg-white/75 text-slate-900 shadow-[0_10px_40px_rgba(15,23,42,0.07)] backdrop-blur-2xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/72 dark:text-white ${mochiy.className}`}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <HeaderNavLink
              href="/"
              localized
              className="group inline-flex shrink-0 items-center gap-2 text-slate-900 transition dark:text-white"
              onClick={closeMenu}
            >
              <span className="rounded-2xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-sm font-bold tracking-[0.2em] text-indigo-600 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:border-indigo-300 group-hover:bg-indigo-100 dark:border-blue-500/20 dark:bg-blue-600/20 dark:text-blue-300 dark:group-hover:bg-blue-600/30">
                DQX
              </span>

              <span className="text-lg font-semibold tracking-wide text-slate-800 transition duration-200 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
                Tools
              </span>

              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-emerald-700 shadow-sm sm:inline-flex dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                {term}
              </span>
            </HeaderNavLink>

            <button
              type="button"
              className={[
                "group relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border transition duration-200",
                "border-slate-200/80 bg-white/85 text-slate-700 shadow-sm hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-950 hover:shadow-md",
                "dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white",
              ].join(" ")}
              onClick={toggleMenu}
              aria-label={open ? t("closeMenu") : t("openMenu")}
              aria-expanded={open}
            >
              <span className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-sky-500/0 to-fuchsia-500/0 opacity-0 transition duration-300 group-hover:opacity-100 dark:from-indigo-500/10 dark:via-sky-500/5 dark:to-fuchsia-500/10" />

              <span className="relative flex h-5 w-5 flex-col items-center justify-center gap-1.5">
                <span
                  className={[
                    "block h-0.5 w-5 rounded-full bg-current transition duration-300",
                    open ? "translate-y-2 rotate-45" : "",
                  ].join(" ")}
                />
                <span
                  className={[
                    "block h-0.5 w-5 rounded-full bg-current transition duration-300",
                    open ? "opacity-0" : "opacity-100",
                  ].join(" ")}
                />
                <span
                  className={[
                    "block h-0.5 w-5 rounded-full bg-current transition duration-300",
                    open ? "-translate-y-2 -rotate-45" : "",
                  ].join(" ")}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {menuVisible && (
        <div
          className={`fixed inset-x-0 z-40 ${mochiy.className}`}
          style={{
            top: `${headerHeight}px`,
            height: `calc(100dvh - ${headerHeight}px)`,
          }}
          onClick={closeMenu}
        >
          <div
            className={[
              "absolute inset-0 bg-white/88 backdrop-blur-[28px] transition-opacity duration-200 dark:bg-slate-950/88",
              open ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />

          <div
            className={[
              "relative h-full overflow-y-auto px-6 py-7 pb-[max(2rem,env(safe-area-inset-bottom))] transition duration-200 ease-out",
              open
                ? "translate-y-0 opacity-100"
                : "-translate-y-3 opacity-0",
            ].join(" ")}
          >
            <div
              className="mx-auto flex min-h-full w-full max-w-md flex-col gap-7 rounded-[2rem] border border-slate-200/70 bg-white/70 px-4 py-5 text-center shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_28px_80px_rgba(0,0,0,0.35)]"
              onClick={(event) => event.stopPropagation()}
            >
              <section className="w-full">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-500">
                  {t("menuTitle")}
                </div>

                <nav className="flex flex-col items-center gap-2">
                  {publicMenus.map((menu, index) => (
                    <HeaderNavLink
                      key={menu.href}
                      href={menu.href}
                      localized={menu.localized}
                      onClick={closeMenu}
                      className="w-full rounded-2xl px-4 py-3 text-center text-lg font-medium text-slate-900 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100/90 hover:shadow-sm dark:text-slate-100 dark:hover:bg-white/10"
                      style={{
                        transitionDelay: open ? `${index * 28}ms` : "0ms",
                      }}
                    >
                      {menu.label}
                    </HeaderNavLink>
                  ))}

                  <a
                    href="https://x.com/miki0801388249"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeMenu}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-center text-lg font-medium text-slate-900 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100/90 hover:shadow-sm dark:text-slate-100 dark:hover:bg-white/10"
                    aria-label="X"
                    title="X"
                  >
                    <FaXTwitter className="h-5 w-5" />
                    <span>X</span>
                  </a>
                </nav>
              </section>

              {showAdminArea ? (
                <HeaderMobileAdminMenu t={t} closeMenu={closeMenu} />
              ) : null}

              {showAdminArea ? (
                <HeaderMobileAuthButtons t={t} closeMenu={closeMenu} />
              ) : null}

              <div className="mt-auto flex flex-col items-center gap-3 pt-4">
                <LanguageSwitcher onNavigate={closeMenu} />

                <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {term}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HeaderMobileAdminMenu({ t, closeMenu }) {
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = Boolean(user?.is_admin);

  const limitedAdminMenus = [
    {
      href: "/admin/tool-editor/monsters",
      label: t("menus.admin.monsters"),
      localized: false,
    },
  ];

  const visibleAdminMenus = isAdmin ? ADMIN_MENUS : limitedAdminMenus;

  return (
    <section className="w-full">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-500 dark:text-indigo-300">
        {t("adminTitle")}
      </div>

      <nav className="flex flex-col items-center gap-2">
        {visibleAdminMenus.map((menu) => (
          <HeaderNavLink
            key={menu.href}
            href={menu.href}
            localized={menu.localized}
            onClick={closeMenu}
            className="w-full rounded-2xl px-4 py-3 text-center text-lg font-medium text-slate-900 transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-sm dark:text-slate-100 dark:hover:bg-indigo-500/15"
          >
            {menu.label}
          </HeaderNavLink>
        ))}
      </nav>
    </section>
  );
}

function HeaderMobileAuthButtons({ t, closeMenu }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <section className="w-full pt-1">
      <div className="mb-3 truncate text-center text-sm text-slate-500 dark:text-slate-400">
        {user.name}
      </div>

      <button
        type="button"
        onClick={() => {
          closeMenu();
          logout();
        }}
        className="w-full rounded-2xl px-4 py-3 text-center text-lg font-medium text-slate-900 transition duration-200 hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-600 hover:shadow-sm dark:text-slate-100 dark:hover:bg-red-500/12 dark:hover:text-white"
      >
        {t("logout")}
      </button>
    </section>
  );
}