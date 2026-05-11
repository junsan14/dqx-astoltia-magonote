export const simpleRangeOptions = [
  {
    id: "30-70",
    label: "中：30〜70",
    lowLabel: "45：45以下",
    middleLabel: "中：30〜70",
    highLabel: "56：56以上",
    lowWin: "45%",
    middleWin: "41%",
    highWin: "45%",
    gap: "14%",
    summary: "45% / 41% / 45%",
    description:
      "中が30〜70の場合、対象は41個。45・56はそれぞれ45個です。",
  },
  {
    id: "28-70",
    label: "中：28〜70",
    lowLabel: "45：45以下",
    middleLabel: "中：28〜70",
    highLabel: "56：56以上",
    lowWin: "45%",
    middleWin: "43%",
    highWin: "45%",
    gap: "12%",
    summary: "45% / 43% / 45%",
    description:
      "中が28〜70の場合、対象は43個。30〜70より中の当たり範囲が少し広くなります。",
  },
  {
    id: "48-53",
    label: "少額向け：48 / 53",
    lowLabel: "48：48以下",
    middleLabel: "中：なし",
    highLabel: "53：53以上",
    lowWin: "48%",
    middleWin: "—",
    highWin: "48%",
    gap: "4%",
    summary: "48% / — / 48%",
    description:
      "金額が少ない場合に48以下・53以上の形になることがあるようです。49〜52の4個は空白になります。",
  },
];