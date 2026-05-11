import AccessoryGuideClient from "./AccessoryGuideClient";

export const metadata = {
  title: "アクセサリ伝承ガイド | DQX TOOL",
  description:
    "アクセサリの伝承元と、どのモンスターを倒せば入手できるかを確認できます。",
};

export default function AccessoryGuidePage() {
  return <AccessoryGuideClient />;
}