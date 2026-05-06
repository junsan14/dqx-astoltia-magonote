"use client";

import NextLink from "next/link";
import { Link as I18nLink } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/auth";
import Link from "next/link";

function FooterNavLink({
  href,
  localized = true,
  className,
  children,
  ...props
}) {
  if (localized) {
    return (
      <I18nLink href={href} className={className} {...props}>
        {children}
      </I18nLink>
    );
  }

  return (
    <NextLink href={href} className={className} {...props}>
      {children}
    </NextLink>
  );
}

export default function Footer() {
  const t = useTranslations("Footer");
  const { user } = useAuth();

  const toolLinks = [
    {
      href: "/tools/craft-profit",
      label: t("links.craftProfit"),
      localized: true,
    },
    {
      href: "/tools/monster-search",
      label: t("links.monsterSearch"),
      localized: true,
    },
    {
      href: "/tools/monster-zukan",
      label: t("links.monsterZukan"),
      localized: true,
    },
    {
      href: "/tools/map-monster-browser",
      label: t("links.mapMonsterBrowser"),
      localized: true,
    },
      {
        href: "/tools/kishoju",
        label:  t("links.kishoju"),
        localized: true,
      },
  ];

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {t("sections.tools")}
            </h3>

            <ul className="mt-4 space-y-2 text-sm">
              {toolLinks.map((link) => (
                <li key={link.href}>
                  <FooterNavLink
                    href={link.href}
                    localized={link.localized}
                    className="transition hover:text-white"
                  >
                    {link.label}
                  </FooterNavLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {t("sections.info")}
            </h3>

            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <FooterNavLink
                  href="/about"
                  localized
                  className="transition hover:text-white"
                >
                  {t("links.about")}
                </FooterNavLink>
              </li>

              <li>
                <span className="text-slate-500">{t("unofficialFanSite")}</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {t("sections.admin")}
            </h3>

            <ul className="mt-4 space-y-2 text-sm">
              {!user && (
                <li>
                  <FooterNavLink
                    href="/login"
                    localized={false}
                    className="inline-flex items-center rounded-full border border-slate-700 px-4 py-1.5 text-xs transition hover:bg-slate-800 hover:text-white"
                  >
                    {t("adminLogin")}
                  </FooterNavLink>
                </li>
              )}

              {user && <Link href="/admin">ADMIN</Link>}
            </ul>
          </div>
        </div>

        <div className="mt-12 space-y-1 border-t border-slate-800 pt-6 text-center text-[11px] leading-relaxed text-slate-500">
          <div>© {new Date().getFullYear()} DQX Tools</div>
          <div>{t("copyrightNotice")}</div>
          <div>© ARMOR PROJECT/BIRD STUDIO/SQUARE ENIX All Rights Reserved.</div>
        </div>
      </div>
    </footer>
  );
}