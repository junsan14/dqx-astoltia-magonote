import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import styles from "./InfoPage.module.css";

export default async function InfoPage({ kicker, title, intro, children }) {
  const t = await getTranslations("SiteInfo");
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <p className={styles.kicker}>{kicker}</p>
          <h1>{title}</h1>
          <p className={styles.intro}>{intro}</p>
        </header>
        <nav className={styles.nav} aria-label={t("navigation")}>
          <Link href="/about">{t("about")}</Link>
          <Link href="/privacy">{t("privacy")}</Link>
          <Link href="/about#contact">{t("contact")}</Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
