import MonsterZukanServer from "@/components/tools/monster-zukan/MonsterZukanServer";
import { createBaseMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEn = locale === "en";

  const title = isEn ? "Monster Encyclopedia" : "モンスター図鑑";

  const description = isEn
    ? "Browse Dragon Quest X monster data, drops, reincarnated monsters, and appearance maps."
    : "ドラクエ10のモンスター情報、ドロップ、転生、出現マップを確認できる図鑑ツールです。";

  return createBaseMetadata({
    locale,
    title,
    description,
    path: `/${locale}/tools/monster-zukan`,
    image: "/ogp/monster-zukan.webp",
  });
}

export default async function Page({ params, searchParams }) {
  const resolvedSearchParams = await searchParams;

  const page = Number(resolvedSearchParams?.page ?? 1) || 1;
  const sort = resolvedSearchParams?.sort === "kana" ? "kana" : "no";

  return <MonsterZukanServer params={params} page={page} sort={sort} />;
}