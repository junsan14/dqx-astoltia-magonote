import HomeHero from "@/components/home/HomeHero";
import { createBaseMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEn = locale === "en";

  const title = isEn
    ? "DQX Adventure Support Tools"
    : "DQX 冒険サポートツール";

  const description = isEn
    ? "Dragon Quest X tools for quickly checking monsters, maps, drops, materials, crafting costs, profits, and accessory inheritance."
    : "ドラクエ10のモンスター、マップ、宝珠、素材、装備原価、利益、アクセサリー伝承をすぐ確認できる冒険サポートツール。";

  return createBaseMetadata({
    locale,
    title,
    description,
    path: `/${locale}`,
    image: "/ogp/home.webp",
  });
}

export default function HomePage() {
  return (
    <main className="homePageMain">
      <HomeHero />
    </main>
  );
}