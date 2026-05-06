import MonstersSearchClient from "@/components/tools/monsters/MonstersSearchClient";
import { createBaseMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEn = locale === "en";

  const title = isEn ? "Monster Search" : "モンスター検索";

  const description = isEn
    ? "Search Dragon Quest X monsters by orb, equipment, or rare drop, and check their locations and map positions."
    : "宝珠・装備・レアドロップから、対象モンスターの出現場所やマップ位置を調べられる検索ツール。";

  return createBaseMetadata({
    locale,
    title,
    description,
    path: `/${locale}/tools/monster-search`,
    image: "/ogp/monster-search.png",
  });
}

export default function Page() {
  return <MonstersSearchClient />;
}