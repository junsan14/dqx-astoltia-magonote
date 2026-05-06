import KishojuHomeClient from "./KishojuHomeClient";
import { createBaseMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEn = locale === "en";

  const title = isEn ? "Crystal Beast Split Room" : "輝晶獣分散共有ツール";

  const description = isEn
    ? "Create and share a Crystal Beast split search room for Dragon Quest X."
    : "輝晶獣の分散ルームを作成・共有できるドラクエ10向けツールです。サーバー情報、ゲージ色、赤・虹チェックを仲間と共有できます。";

  return createBaseMetadata({
    locale,
    title,
    description,
    path: `/${locale}/tools/kishoju`,
    image: "/ogp/kishouju.png",
  });
}

export default async function KishojuPage({ params, searchParams }) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <KishojuHomeClient
      locale={locale}
      initialNotice={resolvedSearchParams?.notice}
    />
  );
}