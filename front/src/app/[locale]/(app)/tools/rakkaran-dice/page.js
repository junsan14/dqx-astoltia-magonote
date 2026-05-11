import RakkaranDiceClient from "./RakkaranDiceClient";

export const metadata = {
  title: "ラッカランダイス ルールまとめ | DQX Tools",
  description:
    "ドラクエ10のラッカランで見かける主なダイスルール、Z・7・45/中/56・株・クラ・爆を整理した注意喚起ページです。",
};

export default function RakkaranDicePage() {
  return <RakkaranDiceClient />;
}