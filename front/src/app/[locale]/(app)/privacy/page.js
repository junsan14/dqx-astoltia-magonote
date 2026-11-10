import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createBaseMetadata } from "@/lib/metadata";
import InfoPage from "@/components/info/InfoPage";
import styles from "@/components/info/InfoPage.module.css";

const SECTIONS = ["operator", "contact", "reports", "rooms", "storage", "ads", "analytics", "sharing", "retention", "choices", "changes"];
const RESOURCES = {
  ads: [
    ["adSettings", "https://myadcenter.google.com/"],
    ["adChoices", "https://optout.aboutads.info/"],
    ["googlePartners", "https://policies.google.com/technologies/partner-sites"],
  ],
  analytics: [
    ["googlePrivacy", "https://policies.google.com/privacy"],
    ["analyticsOptout", "https://tools.google.com/dlpage/gaoptout"],
  ],
  contact: [["xPrivacy", "https://x.com/en/privacy"]],
};

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PrivacyPage" });
  return createBaseMetadata({ locale, title: t("title"), description: t("description"), path: "/privacy" });
}

export default async function PrivacyPage() {
  const t = await getTranslations("PrivacyPage");
  return (
    <InfoPage kicker="PRIVACY POLICY" title={t("title")} intro={t("intro")}>
      {SECTIONS.map(key => (
        <section key={key} id={key} className={styles.section} aria-labelledby={`privacy-${key}`}>
          <h2 id={`privacy-${key}`}>{t(`sections.${key}.title`)}</h2>
          {t.raw(`sections.${key}.paragraphs`).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          {RESOURCES[key] && <ul className={styles.links}>
            {RESOURCES[key].map(([label, href]) => <li key={label}><a href={href}>{t(`links.${label}`)}</a></li>)}
          </ul>}
          {(key === "operator" || key === "choices") && <p><Link href="/about#contact">{t("links.contact")}</Link></p>}
        </section>
      ))}
      <p className={styles.updated}>{t("updatedLabel")} <time dateTime="2026-11-11">2026-11-11</time></p>
    </InfoPage>
  );
}
