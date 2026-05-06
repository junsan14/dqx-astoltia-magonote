import PageHeroTitle from "@/components/PageHeroTitle";
import {getTranslations} from "next-intl/server";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AboutPage" });

  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
    alternates: {
      canonical: "/about",
    },
    openGraph: {
      title: `${t("metadata.title")} | DQX Tools`,
      description: t("metadata.description"),
      url: "https://www.junsan.info/about",
    },
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--page-bg)",
    color: "var(--page-text)",
    padding: "32px 16px 72px",
  },
  container: {
    width: "100%",
    maxWidth: "960px",
    margin: "0 auto",
  },
  section: {
    marginTop: "24px",
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    borderRadius: "24px",
    padding: "24px 20px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    lineHeight: 1.3,
    color: "var(--text-title)",
    fontWeight: 800,
  },
  sectionText: {
    margin: "14px 0 0",
    fontSize: "15px",
    lineHeight: 1.9,
    color: "var(--text-sub)",
  },
  list: {
    margin: "14px 0 0",
    paddingLeft: "1.2em",
    color: "var(--text-sub)",
    lineHeight: 1.9,
    fontSize: "15px",
  },
  noteBox: {
    marginTop: "16px",
    border: "1px solid var(--soft-border)",
    background: "var(--soft-bg)",
    borderRadius: "18px",
    padding: "16px",
    fontSize: "14px",
    lineHeight: 1.8,
    color: "var(--text-sub)",
  },
  footerBox: {
    marginTop: "24px",
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: "13px",
  },
};

export default async function AboutPage() {
  const t = await getTranslations({ namespace: "AboutPage" });

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <PageHeroTitle
          kicker={t("hero.kicker")}
          title={t("hero.title")}
        />

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t("sections.usage.title")}</h2>
          <p style={styles.sectionText}>{t("sections.usage.text")}</p>
          <ul style={styles.list}>
            <li>{t("sections.usage.list.item1")}</li>
            <li>{t("sections.usage.list.item2")}</li>
            <li>{t("sections.usage.list.item3")}</li>
          </ul>

          <div style={styles.noteBox}>
            {t("sections.usage.note")}
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t("sections.repost.title")}</h2>
          <p style={styles.sectionText}>{t("sections.repost.text")}</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t("sections.copyright.title")}</h2>
          <p style={styles.sectionText}>{t("sections.copyright.text")}</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t("sections.unofficial.title")}</h2>
          <p style={styles.sectionText}>{t("sections.unofficial.text")}</p>
        </section>

        <div style={styles.footerBox}>
          {t("footer")}
        </div>
      </div>
    </main>
  );
}