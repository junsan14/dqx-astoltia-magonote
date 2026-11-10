import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createBaseMetadata } from "@/lib/metadata";
import InfoPage from "@/components/info/InfoPage";
import styles from "@/components/info/InfoPage.module.css";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AboutPage" });
  return createBaseMetadata({ locale, title: t("metadata.title"), description: t("metadata.description"), path: "/about" });
}

export default async function AboutPage() {
  const t = await getTranslations("AboutPage");
  return (
    <InfoPage kicker="ABOUT THIS SITE" title={t("hero.title")} intro={t("intro")}>
      <section className={styles.section} aria-labelledby="operator-title">
        <h2 id="operator-title">{t("operator.title")}</h2>
        <dl className={styles.profile}>
          <div><dt>{t("operator.siteLabel")}</dt><dd>アストルティアの孫の手 / DQX Tools</dd></div>
          <div><dt>{t("operator.nameLabel")}</dt><dd>みきてぃ</dd></div>
          <div><dt>{t("operator.urlLabel")}</dt><dd><a href="https://www.dqx-tool.com/">https://www.dqx-tool.com/</a></dd></div>
        </dl>
        <p>{t("operator.description")}</p>
      </section>
      <section className={styles.section} aria-labelledby="maintenance-title">
        <h2 id="maintenance-title">{t("maintenance.title")}</h2>
        <p>{t("maintenance.body")}</p>
        <p><Link href="/announcements">{t("maintenance.link")}</Link></p>
      </section>
      <section id="contact" className={styles.section} aria-labelledby="contact-title">
        <h2 id="contact-title">{t("contact.title")}</h2>
        <p>{t("contact.body")}</p>
        <p><a href="https://x.com/miki0801388249" rel="me">{t("contact.link")}</a></p>
        <p>{t("contact.details")}</p>
        <p>{t("contact.privacyNote")}</p>
        <p><Link href="/privacy">{t("contact.privacyLink")}</Link></p>
      </section>
      <section className={styles.section} aria-labelledby="usage-title">
        <h2 id="usage-title">{t("sections.usage.title")}</h2>
        <p>{t("sections.usage.text")}</p>
        <ul>{["item1", "item2", "item3"].map(key => <li key={key}>{t(`sections.usage.list.${key}`)}</li>)}</ul>
        <p>{t("sections.usage.note")}</p>
      </section>
      {["repost", "copyright", "unofficial"].map(key => (
        <section key={key} className={styles.section} aria-labelledby={`${key}-title`}>
          <h2 id={`${key}-title`}>{t(`sections.${key}.title`)}</h2>
          <p>{t(`sections.${key}.text`)}</p>
        </section>
      ))}
    </InfoPage>
  );
}
