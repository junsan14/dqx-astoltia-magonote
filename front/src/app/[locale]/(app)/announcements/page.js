import PageHeroTitle from "@/components/PageHeroTitle";
import HomeAnnouncements from "@/components/home/HomeAnnouncements";
import { createBaseMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return createBaseMetadata({ locale, title: locale === "en" ? "Updates" : "更新のお知らせ", description: locale === "en" ? "Site updates and new features." : "各ページのデータ更新・修正・新機能のお知らせ。", path: `/${locale}/announcements` });
}

export default async function AnnouncementsPage({ params }) {
  const { locale } = await params;

  return (
    <main>
      <PageHeroTitle
        kicker="DQX UPDATES"
        title={locale === "en" ? "Updates" : "更新のお知らせ"}
      />
      <HomeAnnouncements archive />
    </main>
  );
}
