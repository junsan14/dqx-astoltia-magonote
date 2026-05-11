import { fetchEquipments } from "@/lib/equipments";
import CraftCalculatorClient from "./CraftCalculatorClient";
import styles from "./craft-calculator.module.css";

export const metadata = {
  title: "裁縫職人 数値チェッカー",
  description:
    "ドラクエ10の裁縫職人向けに、大成功に必要な数値と現在値の差分を確認できるツールです。",
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
        <p className={styles.kicker}>Craft Tool</p>
        <h1>裁縫職人 数値チェッカー</h1>
        <p>
          装備の大成功に必要な数値を見ながら、今どれくらい縫えているかを入力できるツールです。
          残り数値、ぴったり、縫いすぎをマスごとに確認できます。
        </p>
      </section>

      <CraftCalculatorClient equipments={equipments} />
    </main>
  );
}