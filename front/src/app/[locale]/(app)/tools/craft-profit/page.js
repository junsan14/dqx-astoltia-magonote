import CraftProfitClient from "@/components/tools/craft-profit/CraftProfitClient";
import { createBaseMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEn = locale === "en";

  const title = isEn ? "Craft Profit Calculator" : "職人利益計算ツール";

  const description = isEn
    ? "A Dragon Quest X crafting tool for checking material cost, total cost, sale price, and profit."
    : "装備の素材費、原価、売値を見ながら利益を確認できるドラクエ10向け職人ツール。";

  return createBaseMetadata({
    locale,
    title,
    description,
    path: `/${locale}/tools/craft-profit`,
    image: "/ogp/craft-profit.webp",
  });
}

export default function CraftProfitPage() {
  return <CraftProfitClient />;
}