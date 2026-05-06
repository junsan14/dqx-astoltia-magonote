import WeightCheckerClient from "./WeightCheckerClient";
import { createBaseMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const isEn = locale === "en";

  const title = isEn ? "Weight Checker" : "おもさチェッカー";

  const description = isEn
    ? "Calculate your Dragon Quest X character weight from equipment, accessories, skills, food, and bonuses, then check which bosses you can push."
    : "装備・アクセサリ・スキル・宝珠・タネ・女神の木・料理などのおもさから、押せるボスを確認できるドラクエ10向けツール。";

  return createBaseMetadata({
    locale,
    title,
    description,
    path: `/${locale}/tools/weight-checker`,
  });
}

export default function WeightCheckerPage() {
  return <WeightCheckerClient />;
}