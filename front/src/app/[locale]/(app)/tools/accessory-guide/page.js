import AccessoryGuideClient from "./AccessoryGuideClient";
import { createBaseMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEn = locale === "en";

  const title = isEn
    ? "Accessory Inheritance Guide"
    : "アクセサリ伝承ガイド";

  const description = isEn
    ? "A Dragon Quest X accessory guide for checking inheritance chains, synthesis effects, and where to obtain accessories."
    : "アクセサリの伝承元、合成効果、入手場所を確認できるドラクエ10向けアクセサリガイド。";

  return createBaseMetadata({
    locale,
    title,
    description,
    path: `/${locale}/tools/accessory-guide`,
    image: "/ogp/accessory-guide.webp?v=20260718",
  });
}

export default function AccessoryGuidePage() {
  return <AccessoryGuideClient />;
}