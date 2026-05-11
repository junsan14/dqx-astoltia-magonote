"use client";

import { useMemo, useState } from "react";
import styles from "./rakkaranDice.module.css";
import { simpleRangeOptions } from "./data/simpleRangeOptions";
import { baseProbabilityRules } from "./data/baseProbabilityRules";

const ruleDetails = [
  {
    id: "z",
    name: "Z",
    subtitle: "ゾロ目を出した方が勝ち",
    description:
      "ゾロ目の略。子、つまり挑戦者側から交互にダイスを振り、先にゾロ目を出せれば勝ちになります。",
    points: [
      "ゾロ目は基本的に 11,22,33,44,55,66,77,88,99",
      "子から交互にダイスを振る",
      "先にゾロ目を出した方が勝ち",
      "同じターンにお互いがゾロ目を出した場合は、同時継続になることが多い",
      "Zには親即と言われる地雷番号が指定されている",
      "親即に指定されている番号は、子が出しても親が出しても親の勝ち",
      "子がゾロ目を出したターンに親が親即を出した場合でも、子の負けになる",
    ],
    caution:
      "Zは一番有名なルールだけど、親即があるため子側は不利になりやすい。親即番号と同時継続の扱いは必ず確認。",
  },
  {
    id: "z3",
    name: "Z3",
    subtitle: "ゾロ目3カウント先取",
    description:
      "Zの派生ルールです。通常のZと違い、ゾロ目を1回出しただけでは勝ちにならず、ゾロ目カウントを3回分ためた方が勝ちになります。",
    points: [
      "ゾロ目を3回出した方が勝ち",
      "子と親が交互にダイスを振る",
      "親指定の目、例：6を出すと、親がゾロ目を1回出したのと同じカウントになる",
      "子が親指定の目を出しても、親側に1カウント入る",
      "親が親指定の目を出しても、親側に1カウント入る",
      "例：子が6、親が88の場合、親は親指定目による1カウントと88のゾロ目1カウントで合計2カウント",
      "親指定目が1個という前提では、子の勝率は約39.51%、親の勝率は約58.76%、同時到達は約1.73%",
    ],
    caution:
      "Z3は親指定目の扱いが重要。指定目が何番なのか、誰が出したら親に何カウント入るのかを確認。",
  },
  {
    id: "reverse-z",
    name: "逆Z",
    subtitle: "ゾロ目を出した方が負け",
    description:
      "通常のZとは逆で、ゾロ目を出した方が負けになるルールです。ただし基本構造はZと同じで、親即が出た場合は親の勝ちになります。",
    points: [
      "ゾロ目を出した方が負け",
      "子が先攻、親が後攻",
      "子と親のどちらかが親即の数字を出した場合は親の勝ち",
      "子がゾロ目を出したあと、親もゾロ目を出したら同時継続",
      "親がゾロ目を出して、子がゾロ目を出していない場合は親の負け",
    ],
    caution:
      "逆Zは『ゾロ目同時は継続』と『親即は誰が出しても親勝ち』を確認。基本Zと同じく、親即の扱いがかなり重要。",
  },
  {
    id: "seven",
    name: "7",
    subtitle: "7が付く数字を出した方が勝ち",
    description:
      "交互にダイスを振り、先に7が付く数字を出した方が勝ちになるルールです。基本的にはZに近いルールです。",
    points: [
      "先に7が付く数字を出した方が勝ち",
      "7,17,27,37,47,57,67,70〜79,87,97 などが対象になることが多い",
      "親即が指定されている場合がある",
      "同じターンにお互いが7の付く数字を出した場合、同時継続や親勝ちなど、親によって扱いが変わる",
    ],
    caution:
      "7はZに近いけど、同時7の扱いが親勝ちなのか継続なのかで大きく変わる。親即の有無も確認。",
  },
  {
    id: "simple",
    name: "45 / 中 / 56",
    subtitle: "1回振って出目で勝敗を決める",
    description:
      "ダイスを1回振って、その出目で勝敗が決まるシンプルなルールです。",
    points: [
      "45：45以下の数字が出たら勝ち",
      "56：56以上の数字が出たら勝ち",
      "中：真ん中の数字が出たら勝ち",
      "中は28〜70、または30〜70に指定されていることが多い",
      "金額が少ない場合は48以下、53以上のような形になることもある",
    ],
    caution:
      "45以下に45を含むか、56以上に56を含むか、中の範囲がどこからどこまでかを確認。",
  },
  {
    id: "kabu",
    name: "株",
    subtitle: "おいちょかぶ系",
    description:
      "花札の『おいちょかぶ』が由来のダイスルールです。出目の一の位と十の位を合計し、その一の位が9に近い方が勝ちです。",
    points: [
      "例：75の場合、7 + 5 = 12 なので数字は2になる",
      "0が最も弱く、9が最強",
      "数字が同じ場合は親の勝ち、または同値継続になる",
      "親即が設定されている場合がある",
      "クッピンやシッピンなどの特殊役が設定されることがある",
    ],
    caution:
      "株は同値親勝ち、親即、特殊役で親有利になりやすい。フリコメ確認必須。",
  },
  {
    id: "kura",
    name: "クラ",
    subtitle: "一の位が大きい方が勝ち",
    description:
      "お互いにダイスを振って、出目の一の位が大きい方が勝ちになります。プレイヤーによっては『倉』と表記されることもあります。",
    points: [
      "出目の一の位だけを見る",
      "0が最も弱く、9が最強",
      "子と親が同じ数字の場合は親勝ち、または同値継続になる",
      "親即が指定されている",
    ],
    caution:
      "同じ数字の場合に親勝ちになることが多く、親即もあるため、子側は不利になりやすい。",
  },
  {
    id: "baku",
    name: "爆",
    subtitle: "規定数を0以下にした方が負け",
    description:
      "お互いがダイスを振って、出目の十の位か一の位を選び、規定数から引いていくルールです。一般的には30爆が多いです。",
    points: [
      "一般的には30爆が多い",
      "ダイスを振る",
      "出目の十の位か一の位のどちらかを選択する",
      "選択した数字を規定数から引く",
      "引いた後の数字をチャットに打ち込む",
      "0以下にしてしまった方が負けとして計算",
      "例：出目が47なら、4か7を選択する",
      "4を選んだ場合、30 - 4 = 26 なので、チャットで26と打ち込む",
      "爆にも親即が設定されている",
    ],
    caution:
      "爆は運だけでなく選択も入るため、他のルールより複雑。親によって細部が違うので確認必須。",
  },
];

const glossary = [
  {
    term: "親",
    kana: "おや",
    description: "ダイスの主催側。ルール、レート、親即、支払い方法などを提示する側。",
  },
  {
    term: "子",
    kana: "こ",
    description: "参加者側、挑戦者側。多くのルールでは子が先にダイスを振る。",
  },
  {
    term: "Z",
    kana: "ぜっと",
    description: "ゾロ目の略。11,22,33,44,55,66,77,88,99など。",
  },
  {
    term: "Z3",
    kana: "ぜっとすりー",
    description:
      "ゾロ目を3カウントためた方が勝ちになるZの派生ルール。親指定の目が親側カウントになることがある。",
  },
  {
    term: "逆Z",
    kana: "ぎゃくぜっと",
    description:
      "ゾロ目を出した方が負けになるルール。基本Zと同じく、親即が出た場合は親勝ち、ゾロ目同時は継続になることが多い。",
  },
  {
    term: "親即",
    kana: "おやそく",
    description: "親が指定した地雷番号。出たら親勝ち、または子の負けになることが多い。",
  },
  {
    term: "同時継続",
    kana: "どうじけいぞく",
    description:
      "同じターンで子と親の両方が勝ち条件を出した場合、勝敗を決めずに続けること。",
  },
  {
    term: "中",
    kana: "なか",
    description: "28〜70、30〜70など、真ん中の範囲が勝ちになる単発系ルール。",
  },
  {
    term: "株",
    kana: "かぶ",
    description:
      "おいちょかぶ系。十の位と一の位を足し、その一の位が9に近い方が勝ち。",
  },
  {
    term: "クラ / 倉",
    kana: "くら",
    description: "一の位が大きい方が勝ち。0が最弱、9が最強。",
  },
  {
    term: "爆",
    kana: "ばく",
    description:
      "規定数から出目の十の位か一の位を引いていき、0以下にした方が負けになるルール。",
  },
  {
    term: "倍プ",
    kana: "ばいぷ",
    description: "前の勝負金額を倍にして続けること。勝てば大きいが、負けると損失も大きい。",
  },
  {
    term: "先払い",
    kana: "さきばらい",
    description: "勝負前に賭け金を支払う方式。詐欺対策として使われることがある。",
  },
];

const checklist = [
  "親即はある？ あるなら何番？",
  "親即は誰が出しても親勝ち？",
  "同時に勝ち条件を出したら継続？ 親勝ち？",
  "同じ数字・同値は親勝ち？ 継続？",
  "特殊役はある？",
  "45・56・中は境界を含む？",
  "爆は0ぴったり負け？ 0以下で負け？",
  "先払い？ 後払い？ 郵送？",
  "倍プや連戦はある？",
];

const formatPercent = (value) => `約${(value * 100).toFixed(2)}%`;

function calculateZLikeRule({ targetCount, instantCount = 1, sameTurnContinue }) {
  const targetRate = targetCount / 100;
  const instantRate = instantCount / 100;
  const otherRate = 1 - targetRate - instantRate;

  const childWinPerRound = targetRate * otherRate;

  const parentWinPerRound =
    instantRate +
    targetRate * instantRate +
    otherRate * (targetRate + instantRate);

  const sameTurnPerRound = targetRate * targetRate;
  const noResultPerRound = otherRate * otherRate;

  if (sameTurnContinue) {
    const denominator = 1 - noResultPerRound - sameTurnPerRound;

    return {
      childWin: formatPercent(childWinPerRound / denominator),
      parentWin: formatPercent(parentWinPerRound / denominator),
      draw: "同時は継続",
    };
  }

  const denominator = 1 - noResultPerRound;

  return {
    childWin: formatPercent(childWinPerRound / denominator),
    parentWin: formatPercent(
      (parentWinPerRound + sameTurnPerRound) / denominator
    ),
    draw: "同時は親勝ち",
  };
}

function calculateSevenRule({ sameTurnContinue }) {
  return calculateZLikeRule({
    targetCount: 19,
    instantCount: 1,
    sameTurnContinue,
  });
}

function calculateSameDigitRule({ sameTurnContinue }) {
  const instantRate = 1 / 100;
  const instantParentWinRate = instantRate + (1 - instantRate) * instantRate;
  const normalRate = (1 - instantRate) * (1 - instantRate);

  const childWinPerRound = normalRate * 0.45;
  const parentWinPerRound = instantParentWinRate + normalRate * 0.45;
  const sameValuePerRound = normalRate * 0.1;

  if (sameTurnContinue) {
    const denominator = 1 - sameValuePerRound;

    return {
      childWin: formatPercent(childWinPerRound / denominator),
      parentWin: formatPercent(parentWinPerRound / denominator),
      draw: "同値は継続",
    };
  }

  return {
    childWin: formatPercent(childWinPerRound),
    parentWin: formatPercent(parentWinPerRound + sameValuePerRound),
    draw: "同値は親勝ち",
  };
}

function getDigitsForBaku(number) {
  if (number === 100) return [1];

  const tens = Math.floor(number / 10);
  const ones = number % 10;

  const digits = number < 10 ? [ones] : [tens, ones];

  const uniquePositiveDigits = [...new Set(digits)].filter(
    (digit) => digit > 0
  );

  return uniquePositiveDigits.length > 0 ? uniquePositiveDigits : [1];
}

function getBakuChoiceDigits(number) {
  if (!number || number < 1 || number > 100) return [];

  if (number === 100) return [1];

  const tens = Math.floor(number / 10);
  const ones = number % 10;

  const digits = number < 10 ? [ones] : [tens, ones];

  return [...new Set(digits)].filter((digit) => digit > 0);
}

function createBakuLogText(log) {
  if (log.length === 0) return "まだ記録はありません。";

  return log
    .map((item, index) => {
      const actor = item.actor === "child" ? "子" : "親";

      if (item.type === "manual") {
        return `${index + 1}. ${actor}：残り数を入力 / ${item.before} → ${item.after}`;
      }

      return `${index + 1}. ${actor}：出目${item.roll} → ${item.choice}を引く / ${item.before} → ${item.after}`;
    })
    .join("\n");
}

function calculateBakuRule({ limit = 30, instantCount = 1 }) {
  const memoChild = new Map();
  const memoParent = new Map();
  const rolls = Array.from({ length: 100 }, (_, index) => index + 1);

  function childTurn(remaining) {
    if (remaining <= 0) return 0;
    if (memoChild.has(remaining)) return memoChild.get(remaining);

    let total = 0;

    for (const roll of rolls) {
      const isInstant = roll <= instantCount;

      if (isInstant) {
        total += 0;
        continue;
      }

      const digits = getDigitsForBaku(roll);

      const bestChoice = Math.max(
        ...digits.map((digit) => {
          if (digit >= remaining) return 0;
          return parentTurn(remaining - digit);
        })
      );

      total += bestChoice;
    }

    const result = total / 100;
    memoChild.set(remaining, result);
    return result;
  }

  function parentTurn(remaining) {
    if (remaining <= 0) return 1;
    if (memoParent.has(remaining)) return memoParent.get(remaining);

    let total = 0;

    for (const roll of rolls) {
      const isInstant = roll <= instantCount;

      if (isInstant) {
        total += 0;
        continue;
      }

      const digits = getDigitsForBaku(roll);

      const bestChoiceForParent = Math.min(
        ...digits.map((digit) => {
          if (digit >= remaining) return 1;
          return childTurn(remaining - digit);
        })
      );

      total += bestChoiceForParent;
    }

    const result = total / 100;
    memoParent.set(remaining, result);
    return result;
  }

  const childWin = childTurn(limit);
  const parentWin = 1 - childWin;

  return {
    childWin: formatPercent(childWin),
    parentWin: formatPercent(parentWin),
    draw: "なし",
    noteExtra:
      instantCount > 0
        ? `親即${instantCount}個込み・${limit}爆・0以下で負け・0は選択肢から除外・両者が有利な数字を選ぶ簡易モデルです。`
        : `${limit}爆・0以下で負け・0は選択肢から除外・両者が有利な数字を選ぶ簡易モデルです。`,
  };
}

function calculateBakuChildWinFromState({ remaining, actor, instantCount = 1 }) {
  const memoChild = new Map();
  const memoParent = new Map();
  const rolls = Array.from({ length: 100 }, (_, index) => index + 1);

  function childTurn(currentRemaining) {
    if (currentRemaining <= 0) return 0;
    if (memoChild.has(currentRemaining)) return memoChild.get(currentRemaining);

    let total = 0;

    for (const roll of rolls) {
      const isInstant = roll <= instantCount;

      if (isInstant) {
        total += 0;
        continue;
      }

      const digits = getDigitsForBaku(roll);

      const bestForChild = Math.max(
        ...digits.map((digit) => {
          const nextRemaining = currentRemaining - digit;
          if (nextRemaining <= 0) return 0;
          return parentTurn(nextRemaining);
        })
      );

      total += bestForChild;
    }

    const result = total / 100;
    memoChild.set(currentRemaining, result);
    return result;
  }

  function parentTurn(currentRemaining) {
    if (currentRemaining <= 0) return 1;
    if (memoParent.has(currentRemaining)) return memoParent.get(currentRemaining);

    let total = 0;

    for (const roll of rolls) {
      const isInstant = roll <= instantCount;

      if (isInstant) {
        total += 0;
        continue;
      }

      const digits = getDigitsForBaku(roll);

      const bestForParent = Math.min(
        ...digits.map((digit) => {
          const nextRemaining = currentRemaining - digit;
          if (nextRemaining <= 0) return 1;
          return childTurn(nextRemaining);
        })
      );

      total += bestForParent;
    }

    const result = total / 100;
    memoParent.set(currentRemaining, result);
    return result;
  }

  return actor === "child" ? childTurn(remaining) : parentTurn(remaining);
}

function evaluateBakuChoices({ remaining, actor, roll, limit = 30, instantCount = 1 }) {
  const digits = getBakuChoiceDigits(roll);

  if (!remaining || remaining <= 0 || digits.length === 0) {
    return [];
  }

  return digits.map((digit) => {
    const nextRemaining = remaining - digit;

    let childWinRate;

    if (actor === "child") {
      childWinRate =
        nextRemaining <= 0
          ? 0
          : calculateBakuChildWinFromState({
              remaining: nextRemaining,
              actor: "parent",
              limit,
              instantCount,
            });
    } else {
      childWinRate =
        nextRemaining <= 0
          ? 1
          : calculateBakuChildWinFromState({
              remaining: nextRemaining,
              actor: "child",
              limit,
              instantCount,
            });
    }

    return {
      digit,
      nextRemaining,
      childWinRate,
      childWinText: formatPercent(childWinRate),
    };
  });
}

function getRecommendedBakuChoice(evaluations, actor) {
  if (evaluations.length === 0) return null;

  if (actor === "child") {
    return evaluations.reduce((best, item) =>
      item.childWinRate > best.childWinRate ? item : best
    );
  }

  return evaluations.reduce((best, item) =>
    item.childWinRate < best.childWinRate ? item : best
  );
}

function calculateRuleResult(rule, sameTurnSettings, bakuLimit) {
  if (rule.calcType === "z") {
    const result = calculateZLikeRule({
      targetCount: 9,
      instantCount: 1,
      sameTurnContinue: sameTurnSettings.z,
    });

    return {
      ...rule,
      ...result,
      draw: sameTurnSettings.z ? "同時Zは継続" : "同時は親勝ち",
    };
  }

  if (rule.calcType === "reverse-z") {
    const result = calculateZLikeRule({
      targetCount: 9,
      instantCount: 1,
      sameTurnContinue: sameTurnSettings["reverse-z"],
    });

    return {
      ...rule,
      ...result,
      draw: sameTurnSettings["reverse-z"]
        ? "同時Zは継続"
        : "同時は親勝ち",
    };
  }

  if (rule.calcType === "seven") {
    const result = calculateSevenRule({
      sameTurnContinue: sameTurnSettings.seven,
    });

    return {
      ...rule,
      ...result,
      draw: sameTurnSettings.seven ? "同時7は継続" : "同時は親勝ち",
    };
  }

  if (rule.calcType === "kabu" || rule.calcType === "kura") {
    const result = calculateSameDigitRule({
      sameTurnContinue: sameTurnSettings[rule.id],
    });

    return {
      ...rule,
      ...result,
      draw: sameTurnSettings[rule.id] ? "同値は継続" : "同値は親勝ち",
    };
  }

  if (rule.calcType === "baku") {
    const result = calculateBakuRule({
      limit: bakuLimit,
      instantCount: 1,
    });

    return {
      ...rule,
      childWin: result.childWin,
      parentWin: result.parentWin,
      draw: result.draw,
      note: `${rule.note} ${result.noteExtra}`,
    };
  }

  return rule;
}

export default function RakkaranDiceClient() {
  const [activeTab, setActiveTab] = useState("probability");
  const [simpleRangeId, setSimpleRangeId] = useState("30-70");
  const [bakuLimit, setBakuLimit] = useState(30);
  const [sameTurnSettings, setSameTurnSettings] = useState({
    z: true,
    "reverse-z": true,
    seven: false,
    kabu: false,
    kura: false,
  });

const [bakuTool, setBakuTool] = useState({
  remaining: 30,
  start: 30,
  roll: "",
  parentRemaining: "",
  actor: "child",
  log: [],
});

  const selectedSimpleRange = useMemo(() => {
    return (
      simpleRangeOptions.find((option) => option.id === simpleRangeId) ||
      simpleRangeOptions[0]
    );
  }, [simpleRangeId]);


const bakuRollNumber = Number(bakuTool.roll);


const bakuEvaluations = useMemo(() => {
  return evaluateBakuChoices({
    remaining: bakuTool.remaining,
    actor: bakuTool.actor,
    roll: bakuRollNumber,
    limit: bakuTool.start,
    instantCount: 1,
  });
}, [bakuTool.remaining, bakuTool.actor, bakuRollNumber, bakuTool.start]);

const recommendedBakuChoice = useMemo(() => {
  return getRecommendedBakuChoice(bakuEvaluations, bakuTool.actor);
}, [bakuEvaluations, bakuTool.actor]);

const handleBakuStartChange = (value) => {
  const nextStart = Number(value);

  setBakuTool({
    remaining: nextStart,
    start: nextStart,
    roll: "",
    parentRemaining: "",
    actor: "child",
    log: [],
  });

  setBakuLimit(nextStart);
};

const handleBakuReset = () => {
  setBakuTool({
    remaining: bakuTool.start,
    start: bakuTool.start,
    roll: "",
    parentRemaining: "",
    actor: "child",
    log: [],
  });
};

const handleBakuChoice = (choice) => {
  const before = bakuTool.remaining;
  const after = before - choice;

  const nextLog = [
    ...bakuTool.log,
    {
      actor: "child",
      roll: bakuRollNumber,
      choice,
      before,
      after,
      type: "choice",
    },
  ];

  setBakuTool({
    ...bakuTool,
    remaining: after,
    roll: "",
    parentRemaining: "",
    actor: "parent",
    log: nextLog,
  });
};

const handleParentRemainingSubmit = () => {
  const nextRemaining = Number(bakuTool.parentRemaining);

  if (
    Number.isNaN(nextRemaining) ||
    nextRemaining < 0 ||
    nextRemaining >= bakuTool.remaining
  ) {
    return;
  }

  const before = bakuTool.remaining;

  const nextLog = [
    ...bakuTool.log,
    {
      actor: "parent",
      before,
      after: nextRemaining,
      type: "manual",
    },
  ];

  setBakuTool({
    ...bakuTool,
    remaining: nextRemaining,
    parentRemaining: "",
    actor: "child",
    log: nextLog,
  });
};

const handleBakuUndo = () => {
  const nextLog = bakuTool.log.slice(0, -1);
  const last = nextLog[nextLog.length - 1];

  setBakuTool({
    ...bakuTool,
    remaining: last ? last.after : bakuTool.start,
    roll: "",
    parentRemaining: "",
    actor: last ? (last.actor === "child" ? "parent" : "child") : "child",
    log: nextLog,
  });
};


  const probabilityRules = useMemo(() => {
    const simpleRule = {
      id: "simple",
      title: "45 / 中 / 56",
      tag: "単発",
      childWin: selectedSimpleRange.summary,
      parentWin: "条件次第",
      draw: selectedSimpleRange.gap,
      judgement: "境界確認",
      condition:
        "ダイスを1回振って、その出目で勝敗が決まる。45以下、56以上、中の範囲などを狙うシンプルなルール。",
      note: selectedSimpleRange.description,
    };

    return [
      ...baseProbabilityRules
        .slice(0, 4)
        .map((rule) => calculateRuleResult(rule, sameTurnSettings, bakuLimit)),
      simpleRule,
      ...baseProbabilityRules
        .slice(4)
        .map((rule) => calculateRuleResult(rule, sameTurnSettings, bakuLimit)),
    ];
  }, [selectedSimpleRange, sameTurnSettings, bakuLimit]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>DQX Tools</p>
        <h1>ラッカランダイス ルールまとめ</h1>
        <p className={styles.lead}>
          ドラクエ10のラッカラン周辺で見かける主なダイスルール、
          Z・Z3・逆Z・7・45/中/56・株・クラ・爆を、勝率・ルール説明・用語集に分けて整理しています。
        </p>

        <div className={styles.notice}>
          <strong>注意：</strong>
          ダイス賭博はトラブルになりやすいためおすすめはしません。
          このページはルール理解と注意喚起を目的にしたまとめです。
          実際の条件は親によって違うため、参加前に必ず確認してください。
        </div>
      </section>

      <section className={styles.tabSection}>
        <div className={styles.tabs} role="tablist" aria-label="ラッカランダイス情報">
          <button
            type="button"
            className={`${styles.tabButton} ${
              activeTab === "probability" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("probability")}
          >
            勝率まとめ
          </button>

          <button
            type="button"
            className={`${styles.tabButton} ${
              activeTab === "rules" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("rules")}
          >
            ルール説明
          </button>

          <button
            type="button"
            className={`${styles.tabButton} ${
              activeTab === "glossary" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("glossary")}
          >
            ダイス用語集
          </button>
        </div>

        {activeTab === "probability" && (
          <div className={styles.tabContent}>
            <section className={styles.sectionInner}>
              <div className={styles.sectionHead}>
                <p className={styles.kicker}>Probability</p>
                <h2>ルール別の勝率・有利不利</h2>
                <p>
                  Z・逆Z・7は同時継続の有無で確率を切り替えできます。
                  株・クラは同値継続の有無で切り替えできます。
                  45/中/56と爆も条件を変更できます。
                </p>
              </div>

              <div className={styles.simpleSimulator}>
                <div>
                  <p className={styles.kicker}>45 / 中 / 56</p>
                  <h3>単発ルールの範囲設定</h3>
                  <p>中の範囲や少額時の48/53ルールに合わせて、表示する確率を切り替えできます。</p>
                </div>

                <label className={styles.selectLabel}>
                  表示する条件
                  <select
                    className={styles.rangeSelect}
                    value={simpleRangeId}
                    onChange={(event) => setSimpleRangeId(event.target.value)}
                  >
                    {simpleRangeOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={styles.simpleProbGrid}>
                  <div className={styles.simpleProbCard}>
                    <span>{selectedSimpleRange.lowLabel}</span>
                    <strong>{selectedSimpleRange.lowWin}</strong>
                  </div>
                  <div className={styles.simpleProbCard}>
                    <span>{selectedSimpleRange.middleLabel}</span>
                    <strong>{selectedSimpleRange.middleWin}</strong>
                  </div>
                  <div className={styles.simpleProbCard}>
                    <span>{selectedSimpleRange.highLabel}</span>
                    <strong>{selectedSimpleRange.highWin}</strong>
                  </div>
                  <div className={styles.simpleProbCard}>
                    <span>空白・範囲外</span>
                    <strong>{selectedSimpleRange.gap}</strong>
                  </div>
                </div>
              </div>

              <div className={styles.simpleSimulator}>
                <div>
                  <p className={styles.kicker}>爆</p>
                  <h3>爆の規定数設定</h3>
                  <p>
                    30爆を基本に、規定数を変更して簡易計算できます。計算は親即1個・0以下で負け・両者が有利な数字を選ぶ前提です。
                  </p>
                </div>

                <label className={styles.selectLabel}>
                  規定数
                  <select
                    className={styles.rangeSelect}
                    value={bakuLimit}
                    onChange={(event) => setBakuLimit(Number(event.target.value))}
                  >
                    <option value={20}>20爆</option>
                    <option value={25}>25爆</option>
                    <option value={30}>30爆</option>
                    <option value={35}>35爆</option>
                    <option value={40}>40爆</option>
                  </select>
                </label>
              </div>

              <div className={styles.bakuTool}>
  <div className={styles.bakuToolHead}>
    <div>
      <p className={styles.kicker}>Baku Calculator</p>
      <h3>爆 計算ツール</h3>
      <p>
        出目を入力して、十の位か一の位を選ぶと残り数を自動計算します。
        0以下にした側が負けです。
      </p>
    </div>

    <label className={styles.selectLabel}>
      初期値
      <select
        className={styles.rangeSelect}
        value={bakuTool.start}
        onChange={(event) => handleBakuStartChange(event.target.value)}
      >
        <option value={20}>20爆</option>
        <option value={25}>25爆</option>
        <option value={30}>30爆</option>
        <option value={35}>35爆</option>
        <option value={40}>40爆</option>
      </select>
    </label>
  </div>

  <div className={styles.bakuStatusGrid}>
    <div className={styles.bakuStatusCard}>
      <span>現在の残り</span>
      <strong className={bakuTool.remaining <= 0 ? styles.loseText : ""}>
        {bakuTool.remaining}
      </strong>
    </div>

    <div className={styles.bakuStatusCard}>
      <span>次に引く人</span>
      <strong>{bakuTool.actor === "child" ? "子" : "親"}</strong>
    </div>

    <div className={styles.bakuStatusCard}>
      <span>状態</span>
      <strong>
        {bakuTool.remaining <= 0
          ? `${bakuTool.actor === "child" ? "親" : "子"}の負け`
          : "進行中"}
      </strong>
    </div>
  </div>

  {bakuTool.actor === "child" ? (
  <>
    <div className={styles.bakuInputRow}>
      <label className={styles.selectLabel}>
        自分の出目を入力
        <input
          className={styles.bakuInput}
          type="number"
          min="1"
          max="100"
          value={bakuTool.roll}
          placeholder="例：85"
          onChange={(event) =>
            setBakuTool((current) => ({
              ...current,
              roll: event.target.value,
            }))
          }
          disabled={bakuTool.remaining <= 0}
        />
      </label>

      <div className={styles.bakuChoiceArea}>
        <span>引く数字を選択</span>

        <div className={styles.bakuChoiceButtons}>
          {bakuEvaluations.length > 0 ? (
            bakuEvaluations.map((item) => (
              <button
                key={item.digit}
                type="button"
                className={`${styles.bakuChoiceButton} ${
                  recommendedBakuChoice?.digit === item.digit
                    ? styles.recommendedButton
                    : ""
                }`}
                onClick={() => handleBakuChoice(item.digit)}
                disabled={bakuTool.remaining <= 0}
              >
                {item.digit}を引く
                {recommendedBakuChoice?.digit === item.digit ? " ★" : ""}
              </button>
            ))
          ) : (
            <p>1〜100の出目を入力してください。</p>
          )}
        </div>
      </div>
    </div>

    {bakuTool.roll &&
      bakuEvaluations.length > 0 &&
      bakuTool.remaining > 0 && (
        <div className={styles.bakuPreview}>
          {recommendedBakuChoice && (
            <div className={styles.bakuRecommend}>
              <span>おすすめ</span>
              <strong>{recommendedBakuChoice.digit}を引く</strong>
              <p>子の勝率が一番高くなる選択です。</p>
            </div>
          )}

          {bakuEvaluations.map((item) => (
            <p key={item.digit}>
              {item.digit}を引くと：{bakuTool.remaining} - {item.digit} ={" "}
              <strong>{item.nextRemaining}</strong>
              {" / "}
              子の勝率：<strong>{item.childWinText}</strong>
              {item.nextRemaining <= 0 ? " / 子の負け" : ""}
            </p>
          ))}
        </div>
      )}
  </>
) : (
  <div className={styles.bakuInputRow}>
    <label className={styles.selectLabel}>
      親が引いた後の残り数
      <input
        className={styles.bakuInput}
        type="number"
        min="0"
        max={bakuTool.remaining - 1}
        value={bakuTool.parentRemaining}
        placeholder={`例：${Math.max(bakuTool.remaining - 2, 0)}`}
        onChange={(event) =>
          setBakuTool((current) => ({
            ...current,
            parentRemaining: event.target.value,
          }))
        }
        disabled={bakuTool.remaining <= 0}
      />
    </label>

    <div className={styles.bakuChoiceArea}>
      <span>親の結果を反映</span>

      <div className={styles.bakuChoiceButtons}>
        <button
          type="button"
          className={styles.bakuChoiceButton}
          onClick={handleParentRemainingSubmit}
          disabled={
            bakuTool.remaining <= 0 ||
            !bakuTool.parentRemaining ||
            Number(bakuTool.parentRemaining) >= bakuTool.remaining
          }
        >
          残り数を反映する
        </button>
      </div>
    </div>
  </div>
)}

  {bakuTool.roll && bakuEvaluations.length > 0 && bakuTool.remaining > 0 && (
  <div className={styles.bakuPreview}>
    {recommendedBakuChoice && (
      <div className={styles.bakuRecommend}>
        <span>おすすめ</span>
        <strong>
          {recommendedBakuChoice.digit}を引く
        </strong>
        <p>
          {bakuTool.actor === "child"
            ? "子の勝率が一番高くなる選択です。"
            : "親が最善を選ぶなら、子の勝率が一番低くなる選択です。"}
        </p>
      </div>
    )}

    {bakuEvaluations.map((item) => (
      <p key={item.digit}>
        {item.digit}を引くと：{bakuTool.remaining} - {item.digit} ={" "}
        <strong>{item.nextRemaining}</strong>
        {" / "}
        子の勝率：<strong>{item.childWinText}</strong>
        {item.nextRemaining <= 0
          ? bakuTool.actor === "child"
            ? " / 子の負け"
            : " / 親の負け"
          : ""}
      </p>
    ))}
  </div>
)}

  <div className={styles.bakuActions}>
    <button type="button" onClick={handleBakuUndo} disabled={bakuTool.log.length === 0}>
      1手戻す
    </button>
    <button type="button" onClick={handleBakuReset}>
      リセット
    </button>
  </div>

  <div className={styles.bakuLog}>
    <div>
      <h4>進行ログ</h4>
      <p>コピペ用</p>
    </div>

    <pre>{createBakuLogText(bakuTool.log)}</pre>
  </div>
</div>

              <div className={styles.ruleResultGrid}>
                {probabilityRules.map((rule) => (
                  <article className={styles.ruleResultCard} key={rule.id}>
                    <div className={styles.ruleResultHead}>
                      <span className={styles.ruleTag}>{rule.tag}</span>
                      <h3>{rule.title}</h3>
                    </div>

                    <p className={styles.condition}>{rule.condition}</p>

                    {rule.calcType && rule.id !== "baku" && (
                      <label className={styles.sameTurnToggle}>
                        <input
                          type="checkbox"
                          checked={sameTurnSettings[rule.id] ?? true}
                          onChange={(event) =>
                            setSameTurnSettings((current) => ({
                              ...current,
                              [rule.id]: event.target.checked,
                            }))
                          }
                        />
                        <span>
                          {rule.id === "kabu" || rule.id === "kura"
                            ? "同じ数字を継続にする"
                            : "同時成立を継続にする"}
                        </span>
                      </label>
                    )}

                    <div className={styles.winGrid}>
                      <div>
                        <span>子の勝率</span>
                        <strong>{rule.childWin}</strong>
                      </div>
                      <div>
                        <span>親の勝率</span>
                        <strong>{rule.parentWin}</strong>
                      </div>
                      <div>
                        <span>引分</span>
                        <strong>{rule.draw}</strong>
                      </div>
                    </div>

                    <div
                      className={`${styles.judgement} ${
                        rule.judgement.includes("不利") ||
                        rule.judgement.includes("親有利")
                          ? styles.bad
                          : styles.neutral
                      }`}
                    >
                      子側の見方：{rule.judgement}
                    </div>

                    <p className={styles.note}>{rule.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.sectionInner}>
              <div className={styles.checkPanel}>
                <div>
                  <p className={styles.kicker}>Before Play</p>
                  <h2>参加前チェック</h2>
                  <p>
                    同じ名前のルールでも、親即・同時判定・同値判定で期待値が変わります。
                  </p>
                </div>

                <ul className={styles.checkList}>
                  {checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        )}

        {activeTab === "rules" && (
          <div className={styles.tabContent}>
            <section className={styles.sectionInner}>
              <div className={styles.sectionHead}>
                <p className={styles.kicker}>Rules</p>
                <h2>主なダイスルール</h2>
                <p>ラッカラン周辺で見かける代表的なルールを、初心者向けに整理しています。</p>
              </div>

              <div className={styles.detailGrid}>
                {ruleDetails.map((rule) => (
                  <article className={styles.detailCard} key={rule.id}>
                    <div className={styles.detailHead}>
                      <h3>{rule.name}</h3>
                      <p>{rule.subtitle}</p>
                    </div>

                    <p className={styles.detailDescription}>{rule.description}</p>

                    <ul>
                      {rule.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>

                    <div className={styles.caution}>
                      <strong>注意：</strong>
                      {rule.caution}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === "glossary" && (
          <div className={styles.tabContent}>
            <section className={styles.sectionInner}>
              <div className={styles.sectionHead}>
                <p className={styles.kicker}>Glossary</p>
                <h2>ダイス用語集</h2>
                <p>
                  略語は親や場所によって意味が変わることがあります。最終的にはフリコメや白チャットで確認してください。
                </p>
              </div>

              <div className={styles.glossaryGrid}>
                {glossary.map((item) => (
                  <article className={styles.glossaryCard} key={item.term}>
                    <div>
                      <h3>{item.term}</h3>
                      <p className={styles.kana}>{item.kana}</p>
                    </div>
                    <p>{item.description}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}