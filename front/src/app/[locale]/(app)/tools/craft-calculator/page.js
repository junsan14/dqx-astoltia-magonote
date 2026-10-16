import { fetchEquipments } from "@/lib/equipments";
import CraftCalculatorClient from "./CraftCalculatorClient";
import styles from "./craft-calculator.module.css";

export const metadata = {
  title: "さいほうナビ",
  description:
    "ドラクエ10の裁縫結果を入力して、次に使う特技と対象マスを確認できる補助ツールです。",
};

export default async function CraftCalculatorPage() {
  let equipments = [];

  try {
    equipments = await fetchEquipments({
      has_slot_grid: 1,
      craft_type: "裁縫",
    });
  } catch (error) {
    console.error(error);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>SEWING COMPANION</p>
        <h1>さいほうナビ</h1>
        <p>
          縫って、入力して、次の一手へ。
          あなたの裁縫を、盤面のとなりでサポート。
        </p>
      </section>

      <CraftCalculatorClient equipments={equipments} />
    </main>
  );
}