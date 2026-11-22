import { getTranslations } from "next-intl/server";
import { createBaseMetadata } from "@/lib/metadata";
import InfoPage from "@/components/info/InfoPage";
import ContactForm from "@/components/contact/ContactForm";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ContactPage" });
  return createBaseMetadata({ locale, title: t("title"), description: t("intro"), path: "/contact" });
}

export default async function ContactPage() {
  const t = await getTranslations("ContactPage");
  return <InfoPage kicker="CONTACT" title={t("title")} intro={t("intro")}><ContactForm /></InfoPage>;
}
