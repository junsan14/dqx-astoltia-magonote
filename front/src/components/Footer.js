"use client";

import NextLink from "next/link";
import { Link as I18nLink } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { useAuth } from "@/hooks/auth";

import styles from "./Footer.module.css";

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

  const currentYear = new Date().getFullYear();

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
      label: t("links.kishoju"),
      localized: true,
    },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.sections}>
          <section className={styles.section}>
            <h3 className={styles.heading}>
              {t("sections.tools")}
            </h3>

            <ul className={styles.linkList}>
              {toolLinks.map((link) => (
                <li
                  key={link.href}
                  className={styles.linkItem}
                >
                  <FooterNavLink
                    href={link.href}
                    localized={link.localized}
                    className={styles.link}
                  >
                    {link.label}
                  </FooterNavLink>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.heading}>
              {t("sections.info")}
            </h3>

            <ul className={styles.linkList}>
              <li className={styles.linkItem}>
                <FooterNavLink
                  href="/about"
                  localized
                  className={styles.link}
                >
                  {t("links.about")}
                </FooterNavLink>
              </li>

              <li className={styles.linkItem}>
                <span className={styles.description}>
                  {t("unofficialFanSite")}
                </span>
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.heading}>
              {t("sections.admin")}
            </h3>

            <ul className={styles.linkList}>
              {!user && (
                <li className={styles.linkItem}>
                  <FooterNavLink
                    href="/login"
                    localized={false}
                    className={styles.adminButton}
                  >
                    {t("adminLogin")}
                  </FooterNavLink>
                </li>
              )}

              {user && (
                <li className={styles.linkItem}>
                  <NextLink
                    href="/admin"
                    className={styles.adminButton}
                  >
                    ADMIN
                  </NextLink>
                </li>
              )}
            </ul>
          </section>
        </div>

        <div className={styles.bottom}>
          <div className={styles.brand}>
            <span>© {currentYear}</span>

            <span className={styles.brandBadge}>
              DQX
            </span>

            <span>Tools</span>
          </div>

          <div className={styles.copyrightNotice}>
            {t("copyrightNotice")}
          </div>

          <div className={styles.rights}>
            © ARMOR PROJECT/BIRD STUDIO/SQUARE ENIX
            All Rights Reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}