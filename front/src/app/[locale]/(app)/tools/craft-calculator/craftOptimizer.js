

// ===== craftOptimizer.js =====
export const CLOTH_TYPES = [
  {
    key: "regen",
    label: "再生布",
    description: "4行動ごとに、誤差±4以内を除いて最も縫った割合が大きいマスが12〜16回復します。",
  },
  {
    key: "pink",
    label: "ピンク布",
    description:
      "4ターンごとにランダム1マスが威力2倍＆会心率アップになります。",
  },
  {
    key: "rainbow",
    label: "虹布",
    description:
      "4ターンごとに、消費集中半分、または消費集中1.5倍で会心率7倍になります。",
  },
];

export const POWER_LABELS = {
  weak: "弱い",
  normal: "普通",
  strong: "強い",
  super: "最強",
  critical: "会心×2",
  unknown: "?",
};

export const POWER_ORDER = ["weak", "normal", "strong", "super", "critical"];

export const POWER_TABLES = {
  noSkill: {
    label: "通常縫い",
    cost: 5,
    type: "single",
    effect: "1マスを1倍の威力で縫う",
    weak: [6, 7, 7, 8, 8, 9, 9],
    normal: [12, 13, 14, 15, 16, 17, 18],
    strong: [18, 20, 21, 23, 24, 26, 27],
    super: [24, 26, 28, 30, 32, 34, 36],
  },
  adjust: {
    label: "かげんぬい",
    cost: 10,
    type: "single",
    effect: "1マスを0.5倍の威力で縫う",
    weak: [3, 4, 4, 4, 4, 5, 5],
    normal: [6, 7, 7, 8, 8, 9, 9],
    strong: [9, 11, 11, 12, 12, 14, 14],
    super: [12, 14, 14, 16, 16, 18, 18],
  },
  halfAdjust: {
    label: "半かげんぬい",
    cost: 12,
    type: "single",
    effect: "1マスを0.75倍の威力で縫う",
    weak: [5, 5, 6, 6, 6, 7, 7],
    normal: [9, 10, 11, 12, 12, 13, 14],
    strong: [14, 15, 17, 18, 18, 20, 21],
    super: [18, 20, 22, 24, 24, 26, 28],
  },
  double: {
    label: "2倍ぬい",
    cost: 9,
    type: "single",
    effect: "1マスを2倍の威力で縫う",
    weak: [12, 13, 14, 15, 16, 17, 18],
    normal: [24, 26, 28, 30, 32, 34, 36],
    strong: [36, 39, 42, 45, 48, 51, 54],
    super: [48, 52, 56, 60, 64, 68, 72],
  },
  triple: {
    label: "3倍ぬい",
    cost: 12,
    type: "single",
    effect: "1マスを3倍の威力で縫う",
    weak: [18, 20, 21, 23, 24, 26, 27],
    normal: [36, 39, 42, 45, 48, 51, 54],
    strong: [54, 59, 63, 68, 72, 77, 81],
    super: [72, 78, 84, 90, 96, 102, 108],
  },
  loosen: {
    label: "糸ほぐし",
    cost: 16,
    type: "singleRecover",
    effect: "1マスを約0.5倍ぶん回復する",
    weak: [-3, -3, -3, -3, -4, -4, -4],
    normal: [-6, -6, -7, -7, -8, -8, -9],
    strong: [-9, -9, -10, -10, -12, -12, -13],
    super: [-12, -12, -14, -14, -16, -16, -18],
  },
  horizontal: {
    label: "ヨコぬい",
    cost: 8,
    type: "multi",
    baseSkillKey: "noSkill",
    effect: "ヨコ2マスを1倍の威力で縫う",
  },
  level: {
    label: "水平ぬい",
    cost: 10,
    type: "multi",
    baseSkillKey: "noSkill",
    effect: "ヨコ3マスを1倍の威力で縫う",
  },
  waterfall: {
    label: "滝のぼり",
    cost: 8,
    type: "multi",
    baseSkillKey: "noSkill",
    effect: "タテ2マスを1倍の威力で縫う",
  },
  bigWaterfall: {
    label: "大滝のぼり",
    cost: 10,
    type: "multi",
    baseSkillKey: "noSkill",
    effect: "タテ3マスを1倍の威力で縫う",
  },
  tasuki: {
    label: "たすきぬい",
    cost: 7,
    type: "multi",
    baseSkillKey: "noSkill",
    effect: "ナナメ2マスを右上へ1倍の威力で縫う",
  },
  reverseTasuki: {
    label: "逆たすきぬい",
    cost: 7,
    type: "multi",
    baseSkillKey: "noSkill",
    effect: "ナナメ2マスを左上へ1倍の威力で縫う",
  },
  wrap: {
    label: "巻きこみぬい",
    cost: 13,
    type: "wrap",
    baseSkillKey: "noSkill",
    effect: "中心を1.5倍、上下左右を0.75倍で縫う",
  },
  randomSew: {
    label: "乱れぬい",
    cost: 7,
    type: "randomMulti",
    baseSkillKey: "noSkill",
    effect: "ランダム複数マスを縫う。実際の対象マスは結果入力で調整。",
  },
  aim: {
    label: "ねらいぬい",
    cost: 16,
    type: "single",
    baseSkillKey: "noSkill",
    effect: "通常よりも高い会心率で1マス縫う",
  },
  powerShift: {
    label: "ぬいパワーシフト",
    cost: 7,
    type: "support",
    effect: "次のぬいパワーをランダムに変更",
  },
  focus: {
    label: "精神統一",
    cost: 7,
    type: "support",
    effect: "ぬいパワーが3ターンそのまま変わらない",
  },
  basting: {
    label: "しつけがけ",
    cost: 13,
    type: "support",
    effect: "使用したマスを次に縫う時2倍の威力になる",
  },
};

export const SKILL_LIST = Object.entries(POWER_TABLES).map(([key, skill]) => ({
  key,
  label: skill.label,
  cost: skill.cost,
  effect: skill.effect,
}));

const PATTERN_DEFINITIONS = {
  noSkill: [{ label: "", cells: [{ dr: 0, dc: 0, rate: 1 }] }],
  adjust: [{ label: "", cells: [{ dr: 0, dc: 0, rate: 1 }] }],
  halfAdjust: [{ label: "", cells: [{ dr: 0, dc: 0, rate: 1 }] }],
  double: [{ label: "", cells: [{ dr: 0, dc: 0, rate: 1 }] }],
  triple: [{ label: "", cells: [{ dr: 0, dc: 0, rate: 1 }] }],
  loosen: [{ label: "", cells: [{ dr: 0, dc: 0, rate: 1 }] }],
  aim: [{ label: "", cells: [{ dr: 0, dc: 0, rate: 1 }] }],

  horizontal: [
    {
      label: "右2マス",
      cells: [
        { dr: 0, dc: 0, rate: 1 },
        { dr: 0, dc: 1, rate: 1 },
      ],
    },
    {
      label: "左2マス",
      cells: [
        { dr: 0, dc: -1, rate: 1 },
        { dr: 0, dc: 0, rate: 1 },
      ],
    },
  ],

  level: [
    {
      label: "横3マス",
      cells: [
        { dr: 0, dc: -1, rate: 1 },
        { dr: 0, dc: 0, rate: 1 },
        { dr: 0, dc: 1, rate: 1 },
      ],
    },
    {
      label: "右3マス",
      cells: [
        { dr: 0, dc: 0, rate: 1 },
        { dr: 0, dc: 1, rate: 1 },
        { dr: 0, dc: 2, rate: 1 },
      ],
    },
    {
      label: "左3マス",
      cells: [
        { dr: 0, dc: -2, rate: 1 },
        { dr: 0, dc: -1, rate: 1 },
        { dr: 0, dc: 0, rate: 1 },
      ],
    },
  ],

  waterfall: [
    {
      label: "下2マス",
      cells: [
        { dr: 0, dc: 0, rate: 1 },
        { dr: 1, dc: 0, rate: 1 },
      ],
    },
    {
      label: "上2マス",
      cells: [
        { dr: -1, dc: 0, rate: 1 },
        { dr: 0, dc: 0, rate: 1 },
      ],
    },
  ],

  bigWaterfall: [
    {
      label: "縦3マス",
      cells: [
        { dr: -1, dc: 0, rate: 1 },
        { dr: 0, dc: 0, rate: 1 },
        { dr: 1, dc: 0, rate: 1 },
      ],
    },
    {
      label: "下3マス",
      cells: [
        { dr: 0, dc: 0, rate: 1 },
        { dr: 1, dc: 0, rate: 1 },
        { dr: 2, dc: 0, rate: 1 },
      ],
    },
    {
      label: "上3マス",
      cells: [
        { dr: -2, dc: 0, rate: 1 },
        { dr: -1, dc: 0, rate: 1 },
        { dr: 0, dc: 0, rate: 1 },
      ],
    },
  ],

  tasuki: [
    {
      label: "右上",
      cells: [
        { dr: 0, dc: 0, rate: 1 },
        { dr: -1, dc: 1, rate: 1 },
      ],
    },
    {
      label: "左下",
      cells: [
        { dr: 1, dc: -1, rate: 1 },
        { dr: 0, dc: 0, rate: 1 },
      ],
    },
  ],

  reverseTasuki: [
    {
      label: "左上",
      cells: [
        { dr: 0, dc: 0, rate: 1 },
        { dr: -1, dc: -1, rate: 1 },
      ],
    },
    {
      label: "右下",
      cells: [
        { dr: 1, dc: 1, rate: 1 },
        { dr: 0, dc: 0, rate: 1 },
      ],
    },
  ],

  wrap: [
    {
      label: "中心",
      cells: [
        { dr: 0, dc: 0, rate: 1.5, role: "center" },
        { dr: -1, dc: 0, rate: 0.75, role: "around" },
        { dr: 1, dc: 0, rate: 0.75, role: "around" },
        { dr: 0, dc: -1, rate: 0.75, role: "around" },
        { dr: 0, dc: 1, rate: 0.75, role: "around" },
      ],
    },
  ],
};

export function getCellDisplayName(rowIndex, colIndex) {
  const rowNames = ["上", "中", "下", "4段目", "5段目"];
  const colNames = ["左", "中", "右", "4列目", "5列目"];

  return `${rowNames[rowIndex] ?? `${rowIndex + 1}段目`}${
    colNames[colIndex] ?? `${colIndex + 1}列目`
  }`;
}

function getCellKey(rowIndex, colIndex) {
  return `${rowIndex}-${colIndex}`;
}

// Calculation order follows the independently measured tables linked in RESEARCH.md.
// These are non-critical outcomes; equipment-specific critical chance is not assumed.
export function getSewNumbers(skillKey, power, rate = 1, doubled = false, glowing = false) {
  const powerRate = { weak: 0.5, normal: 1, strong: 1.5, super: 2, critical: 1 }[power];
  const skillRate = { adjust: 0.5, halfAdjust: 0.75, double: 2, triple: 3, loosen: -0.5 }[skillKey] ?? rate;
  if (!powerRate) return [];
  return Array.from({ length: 7 }, (_, i) => {
    const normal = Math.ceil((12 + i) * skillRate);
    const amount = skillKey === "loosen" && doubled
      ? normal * powerRate * 2
      : Math.ceil(normal * powerRate) * (doubled ? 2 : 1);
    return amount * (glowing ? 2 : 1);
  });
}

export function isClothEffectTurn(turnCount) {
  return Number(turnCount) >= 5 && (Number(turnCount) - 1) % 4 === 0;
}

export function getNextClothTurn(turnCount) {
  const turn = Math.max(1, Number(turnCount) || 1);
  return isClothEffectTurn(turn) ? turn : 1 + Math.ceil(turn / 4) * 4;
}

export function getClothEvent(clothType, turnCount, clothEvents = {}) {
  if (!isClothEffectTurn(turnCount)) return null;
  const recorded = clothEvents[String(turnCount)];
  if (recorded) return recorded;
  if (clothType === "rainbow") {
    return { rainbowMode: (turnCount - 1) % 8 === 4 ? "halfCost" : "critical" };
  }
  return null;
}

export function getEffectiveCost(baseCost, clothType, turnCount, clothEvents = {}) {
  const event = getClothEvent(clothType, turnCount, clothEvents);
  const multiplier = clothType === "rainbow" && event
    ? event.rainbowMode === "halfCost" ? 0.5 : 1.5 : 1;
  return Math.ceil(baseCost * multiplier);
}

function validCells(grid, values) {
  return grid.flatMap((row, rowIndex) => row.flatMap((cell, colIndex) => {
    if (!cell || !Number.isFinite(Number(cell.target)) || Number(cell.target) <= 0) return [];
    const cellKey = getCellKey(rowIndex, colIndex);
    const current = Number(values[cellKey] ?? 0);
    if (!Number.isFinite(current) || current < 0) return [];
    return [{ rowIndex, colIndex, cellKey, target: Number(cell.target), current,
      diff: Number(cell.target) - current, name: getCellDisplayName(rowIndex, colIndex) }];
  }));
}

export function getBoardSummary(grid, values, tolerance = 0) {
  const cells = validCells(grid, values);
  const totalError = cells.reduce((sum, c) => sum + Math.abs(c.diff), 0);
  return { totalError, cellCount: cells.length,
    withinTolerance: cells.length > 0 && totalError <= tolerance };
}

// Regen chooses by progress ratio, not largest raw damage. Ties remain alternatives.
export function getRegenTargets(grid, values) {
  const eligible = validCells(grid, values).filter(c => Math.abs(c.diff) > 4 && c.current > 0);
  const maximum = Math.max(...eligible.map(c => c.current / c.target));
  return eligible.filter(c => Math.abs(c.current / c.target - maximum) < 1e-9);
}

function mean(list) { return list.reduce((sum, v) => sum + v, 0) / list.length; }

// Terminal value of a residual: protect ±1, prefer residuals a weak adjustment can finish.
// This is a heuristic cost, never a claim of actual success probability.
function residualCost(diff, power = "weak") {
  const error = Math.abs(diff);
  if (error <= 1) return error * 0.8;
  if (diff < 0) return 10 + error * 1.8;
  if (diff > 36) return 5 + diff * 0.38;
  const finishes = ["noSkill", "adjust", "halfAdjust", "double"];
  return Math.min(4 + error * 0.65, ...finishes.map(skill =>
    mean(getSewNumbers(skill, power).map(n => Math.abs(diff - n))) * 1.6 + POWER_TABLES[skill].cost * 0.22
  ));
}

function createSewCandidate(state, skillKey, pattern, anchor) {
  const { grid, values, currentPower, mentalPower, clothType, clothEvents, turnCount, bastingCells } = state;
  const cost = getEffectiveCost(POWER_TABLES[skillKey].cost, clothType, turnCount, clothEvents);
  if (cost > mentalPower) return null;
  const event = getClothEvent(clothType, turnCount, clothEvents);
  const recover = skillKey === "loosen";
  const affectedPreview = [];
  for (const point of pattern.cells) {
    const rowIndex = anchor.rowIndex + point.dr, colIndex = anchor.colIndex + point.dc;
    const cell = grid[rowIndex]?.[colIndex];
    // A wrap centered on an edge only includes existing neighbouring cells.
    if (!cell || !Number.isFinite(Number(cell.target)) || Number(cell.target) <= 0) {
      if (skillKey === "wrap" && point.role === "around") continue;
      return null;
    }
    const cellKey = getCellKey(rowIndex, colIndex);
    const current = Number(values[cellKey] ?? 0), target = Number(cell.target), diff = target - current;
    if (!Number.isFinite(current) || current < 0 || (recover ? diff >= -1 : diff <= 1)) return null;
    const glowing = clothType === "pink" && event?.cellKeys?.includes(cellKey);
    const numbers = getSewNumbers(skillKey, currentPower, point.rate, !!bastingCells[cellKey], glowing);
    const min = Math.min(...numbers), max = Math.max(...numbers), avg = mean(numbers);
    affectedPreview.push({ rowIndex, colIndex, cellKey, current, target, diff, min, max,
      avg: Math.round(avg), expectedCurrent: Math.max(0, current + Math.round(avg)),
      overRate: recover ? 0 : numbers.filter(n => n > diff).length / 7,
      isRecover: recover, name: getCellDisplayName(rowIndex, colIndex), rate: point.rate,
      numbers, glowing: !!glowing, basted: !!bastingCells[cellKey], role: point.role ?? "normal" });
  }
  if (!affectedPreview.length) return null;
  const affectedKey = affectedPreview.map(c => `${c.cellKey}:${c.rate}`).sort().join(",");
  return { key: `${skillKey}:${affectedKey}`, skillKey, label: POWER_TABLES[skillKey].label,
    baseLabel: POWER_TABLES[skillKey].label, cellName: anchor.name,
    rowIndex: anchor.rowIndex, colIndex: anchor.colIndex, effectiveCost: cost,
    cost: POWER_TABLES[skillKey].cost, mentalAfter: mentalPower - cost,
    affected: affectedPreview, affectedPreview,
    maxOverRate: Math.max(...affectedPreview.map(c => c.overRate)),
    range: affectedPreview.map(c => `${c.min}〜${c.max}`).join(" / "),
    actionSummary: affectedPreview.map(c => `${c.name}:${c.min}〜${c.max}`).join(" / ") };
}

function evaluateCandidate(candidate, state, cells) {
  const { nextPower, currentPower, clothType, turnCount, mentalPower, focusTurns } = state;
  const finishPower = focusTurns > 1 ? state.heldPower || currentPower : nextPower === "unknown" ? "weak" : nextPower;
  let gain = 0, progress = 0, risk = 0, finishFit = 0, regenCredit = 0;
  const afterValues = { ...state.values };
  for (const item of candidate.affectedPreview) afterValues[item.cellKey] = item.expectedCurrent;
  const regenNext = clothType === "regen" && isClothEffectTurn(turnCount + 1);
  const regenTargets = regenNext ? getRegenTargets(state.grid, afterValues) : [];
  for (const item of candidate.affectedPreview) {
    const after = item.numbers.map(n => item.diff - n);
    gain += residualCost(item.diff, finishPower) - mean(after.map(d => residualCost(d, finishPower)));
    progress += Math.max(0, item.diff - mean(after.map(d => Math.abs(d))));
    risk += mean(after.map(d => Math.max(0, -d))) * (clothType === "regen" ? 0.7 : 2.8);
    finishFit += after.filter(d => Math.abs(d) <= 1).length / 7;
    // Only consider deliberate overrun immediately before regen, with one predicted target.
    if (regenTargets.length === 1 && regenTargets[0].cellKey === item.cellKey) {
      const recovered = after.flatMap(d => [12,13,14,15,16].map(r => Math.min(item.target, d + r)));
      const benefit = mean(after.map(d => residualCost(d, finishPower))) - mean(recovered.map(d => residualCost(d, finishPower)));
      if (benefit > 0 && after.every(d => d < -4)) regenCredit += Math.min(12, benefit);
    }
  }
  const reserve = cells.filter(c => Math.abs(c.diff) > 1).length * 5;
  const costWeight = mentalPower < reserve + 30 ? 1.2 : 0.45;
  let score = candidate.effectiveCost * costWeight - gain * 2 - progress * 0.35 + risk - finishFit * 5 - regenCredit * 2;
  const early = cells.reduce((sum,c)=>sum+Math.max(0,c.diff),0) > cells.reduce((sum,c)=>sum+c.target,0) * 0.55;
  // Normal sewing is a preference for an opening/bridge turn, not a universal hard override.
  if (candidate.skillKey === "noSkill" && early && !focusTurns && currentPower !== "super" && candidate.maxOverRate === 0) score -= nextPower === "super" ? 28 : 7;
  // Keep a useful line for the next strongest turn rather than finishing its smallest member first.
  if (nextPower === "super" && currentPower !== "super") {
    score += candidate.affectedPreview.filter(c => c.diff >= 24 && c.diff - c.avg < 24).length * 3;
  }
  const event = getClothEvent(clothType, turnCount, state.clothEvents);
  const criticalWindow = currentPower === "critical" || event?.rainbowMode === "critical" || candidate.affectedPreview.some(c => c.glowing);
  const criticalFit = candidate.affectedPreview.filter(c => c.diff > 0 && c.diff >= c.min && c.diff <= c.max * 2).length;
  if (criticalWindow && criticalFit > 0) score -= criticalFit * 7;
  if (candidate.skillKey === "aim") {
    // Do not invent a needle critical rate; treat aim only as a conditional option.
    if (!criticalFit) score += 35;
    else if (event?.rainbowMode === "halfCost") score -= 4;
  }
  const reasons = [];
  if (regenCredit > 0) reasons.push("次の再生で戻す準備。予測対象は1マスですが、会心が出たら対象を再確認してください。");
  if (criticalWindow && criticalFit) reasons.push("布の会心チャンスに合わせて、会心時に目標へ届く範囲を狙います（会心発生は未保証）。");
  if (finishFit > 0) reasons.push("今回の数値表に、誤差±1以内へ寄せられる結果があります。");
  if (candidate.affectedPreview.length > 1) reasons.push(`${candidate.affectedPreview.length}マスをまとめ、集中力を節約します。`);
  if (nextPower === "weak" && !regenCredit) reasons.push("次の弱いパワーで調整する余地も比較しています。");
  if (!reasons.length) reasons.push(early ? "序盤の進行と、その後に調整しやすい残り数値を比較しています。" : "残り数値と集中力を使って、仕上げやすい手を比較しています。");
  const riskText = candidate.maxOverRate > 0
    ? "通常結果でも超過する可能性があります。対象マスの範囲を確認してください。"
    : "通常結果の範囲では超過しません。会心は別途考慮が必要です。";
  return { ...candidate, score, globalScore: score, reason: reasons.join(" "), riskText,
    strategy: regenCredit > 0 ? "再生を利用" : criticalWindow ? "布効果を活用" : early ? "縫い進める" : "仕上げ調整" };
}

function supportCandidate(skillKey, state, cell, reason, score) {
  const cost = getEffectiveCost(POWER_TABLES[skillKey].cost, state.clothType, state.turnCount, state.clothEvents);
  const affected = cell ? [{ ...cell, min: 0, max: 0, avg: 0, expectedCurrent: cell.current, overRate: 0 }] : [];
  return { key: `${skillKey}:${cell?.cellKey ?? "all"}`, skillKey,
    label: POWER_TABLES[skillKey].label, cellName: cell?.name ?? "全体", effectiveCost: cost,
    mentalAfter: state.mentalPower - cost, affected, affectedPreview: affected,
    maxOverRate: 0, reason, riskText: "ゲーム内で特技を使ってから反映してください。",
    actionSummary: `集中${cost} / 残${state.mentalPower - cost}`, score, globalScore: score,
    strategy: skillKey === "focus" ? "パワーを維持" : "次の一手の準備" };
}

export function getGlobalOptimizedCandidates(input) {
  const state = { values: {}, currentPower: "unknown", nextPower: "unknown", mentalPower: 0,
    turnCount: 1, clothType: "regen", clothEvents: {}, focusTurns: 0, bastingCells: {},
    tolerance: 0, limit: 5, ...input };
  const { grid, currentPower, nextPower, mentalPower, focusTurns } = state;
  if (!Array.isArray(grid) || !POWER_ORDER.includes(currentPower) || !Number.isFinite(mentalPower) || mentalPower < 0) return [];
  const cells = validCells(grid, state.values);
  if (!cells.length || getBoardSummary(grid, state.values, state.tolerance).withinTolerance) return [];
  // Pink effect is observed, not guessed. Do not suggest a move before the lit cell is entered.
  if (state.clothType === "pink" && isClothEffectTurn(state.turnCount) && !getClothEvent("pink", state.turnCount, state.clothEvents)?.cellKeys?.length) return [];
  const unique = new Map();
  for (const cell of cells) for (const [skill, patterns] of Object.entries(PATTERN_DEFINITIONS)) {
    for (const pattern of patterns) {
      const c = createSewCandidate(state, skill, pattern, cell);
      if (c) unique.set(c.key, evaluateCandidate(c, state, cells));
    }
  }
  const candidates = [...unique.values()];
  const bestScore = Math.min(0, ...candidates.map(c => c.score));
  const focusCost = getEffectiveCost(7, state.clothType, state.turnCount, state.clothEvents);
  const canAffordFocus = mentalPower >= focusCost + 15;
  const usefulStrong = cells.reduce((sum,c)=>sum+Math.max(0,Math.floor(c.diff / 36)),0) >= 3;
  const usefulWeak = cells.filter(c => c.diff >= 3 && c.diff <= 18).length >= 2;
  const renewing = focusTurns > 0;
  const nextIsSame = nextPower === currentPower;
  if (canAffordFocus && !nextIsSame && focusTurns <= 1 &&
      ((currentPower === "super" && usefulStrong) || (currentPower === "weak" && usefulWeak && nextPower !== "weak"))) {
    candidates.push(supportCandidate("focus", state, null,
      currentPower === "super"
        ? `${renewing ? "最強をかけ直して" : "最強を維持して"}、複数手で縫い進めます。残り数値と最低限の集中力を確認済みです。`
        : "仕上げに使える弱いパワーを維持します。調整が必要なマスが複数あります。",
      bestScore - (currentPower === "super" ? 4 : 1)));
  }
  // A conservative two-step basting plan: only when doubled next-power triple can fit.
  // Unknown future power and guesses about future glowing cells are not used.
  const futurePower = focusTurns > 1 ? state.heldPower || currentPower : nextPower;
  if (POWER_ORDER.includes(futurePower)) {
    const setupCost = getEffectiveCost(13, state.clothType, state.turnCount, state.clothEvents);
    const followCost = getEffectiveCost(12, state.clothType, state.turnCount + 1, state.clothEvents);
    for (const cell of cells) {
      if (state.bastingCells[cell.cellKey]) continue;
      const damages = getSewNumbers("triple", futurePower, 1, true);
      if (mentalPower < setupCost + followCost + 10 || cell.diff < Math.max(...damages)) continue;
      if (cell.diff < 120) continue;
      const futureResidual = mean(damages.map(n => residualCost(cell.diff - n)));
      const baseline = residualCost(cell.diff);
      const score = (setupCost + followCost) * .6 - (baseline - futureResidual) * 2;
      candidates.push(supportCandidate("basting", state, cell,
        `次の${POWER_LABELS[futurePower]}で3倍ぬいを使う準備。しつけ後の通常範囲は${Math.min(...damages)}〜${Math.max(...damages)}。次の布効果・会心で方針は再計算します。`, score));
    }
  }
  // Preserve concentration on weak opening turns when the remaining work is expensive.
  const remaining = cells.reduce((sum,c) => sum + Math.max(0,c.diff), 0);
  const total = cells.reduce((sum,c) => sum + c.target, 0);
  const reserve = cells.filter(c => Math.abs(c.diff) > 1).length * 5;
  const estimatedStrongCost = remaining / 6 + reserve;
  if (currentPower === "weak" && remaining > total * .55 && mentalPower <= estimatedStrongCost * 1.5) {
    const ordinary = candidates.filter(c => c.skillKey === "noSkill" && c.maxOverRate === 0);
    const best = Math.min(0, ...candidates.map(c => c.score));
    ordinary.forEach(c => { c.score = best - 10; c.globalScore = c.score; c.strategy = "集中力を温存";
      c.reason = `残りの必要数値${remaining}に対して集中力${mentalPower}。弱い間は通常ぬいで進め、強いパワーと仕上げに集中力を残します。`; });
  }
  const unsettled = cells.filter(c => Math.abs(c.diff) > 1);
  const shiftCost = getEffectiveCost(7, state.clothType, state.turnCount, state.clothEvents);
  const tooStrong = unsettled.length > 0 && unsettled.every(c => {
    if (c.diff <= 0) return false;
    const numbers = getSewNumbers("adjust", currentPower, 1, !!state.bastingCells[c.cellKey], !!getClothEvent(state.clothType, state.turnCount, state.clothEvents)?.cellKeys?.includes(c.cellKey));
    return Math.min(...numbers) - c.diff > Math.max(2, c.diff);
  });
  if (["strong", "super"].includes(currentPower) && tooStrong && mentalPower >= shiftCost + 5) {
    candidates.push(supportCandidate("powerShift", state, null,
      "かげんぬいでも残り数値を大きく超えるため、縫わずにパワーを変更する選択肢です。弱いになる保証はありません。実際の表示を入力してください。",
      Math.min(0, ...candidates.map(c => c.score)) - 5));
  }
  // Random-sew distribution is not modelled.
  const ranked = candidates.sort((a,b)=>a.score-b.score || a.effectiveCost-b.effectiveCost);
  return state.searchDepth === 0 ? ranked.slice(0,state.limit) : rankFinishingPlans(ranked, state, cells).slice(0,state.limit);
}

export function applySewingResult({ values, bastingCells = {}, candidate, results }) {
  const nextValues = { ...values }, nextBasting = { ...bastingCells };
  if (candidate.skillKey === "basting") {
    for (const item of candidate.affectedPreview) nextBasting[item.cellKey] = true;
    return { values: nextValues, bastingCells: nextBasting };
  }
  if (candidate.skillKey === "focus" || candidate.skillKey === "powerShift") return { values: nextValues, bastingCells: nextBasting };
  const keys = candidate.skillKey === "randomSew" ? Object.keys(results) : candidate.affectedPreview.map(c=>c.cellKey);
  for (const key of keys) {
    const value = results[key];
    if (value === undefined || String(value).trim() === "" || !Number.isSafeInteger(Number(value)) || Number(value) < 0) throw new Error("現在値は0以上の整数で入力してください。");
    if (candidate.skillKey !== "randomSew" || Number(value) !== Number(values[key])) delete nextBasting[key];
    nextValues[key] = String(Number(value));
  }
  return { values: nextValues, bastingCells: nextBasting };
}

export function getPowerRangeLabel(skillKey, powerKey) {
  if (!POWER_TABLES[skillKey] || ["focus", "powerShift", "basting", "randomSew"].includes(skillKey)) return "-";
  const numbers = getSewNumbers(skillKey, powerKey);
  return numbers.length ? `${Math.min(...numbers)}〜${Math.max(...numbers)}` : "-";
}

// Focus inserts held actions into the underlying sequence; it never consumes the queue early.
export function advancePowerState({ currentPower, nextPower, focusTurns = 0, powerQueue = [], heldPower = "" }, forceUnknown = false) {
  if (focusTurns > 1) {
    return { currentPower: forceUnknown ? "unknown" : heldPower || currentPower,
      nextPower, focusTurns: focusTurns - 1, powerQueue: [...powerQueue],
      ...(heldPower || forceUnknown ? { heldPower: heldPower || currentPower } : {}) };
  }
  return { currentPower: forceUnknown ? "unknown" : nextPower,
    nextPower: powerQueue[0] ?? "unknown", focusTurns: 0, powerQueue: powerQueue.slice(1),
    ...(heldPower ? { heldPower: "" } : {}) };
}

export function getEquipmentTolerance(equipment = {}) {
  const type = equipment.equipmentType ?? equipment.equipment_type ?? {};
  const category = [equipment.equipmentTypeName, equipment.equipment_type_name, type.name, type.key,
    equipment.part, equipment.slot, equipment.groupName, equipment.groupKind].filter(Boolean).join(" ");
  if (/からだ上|体上|body_upper|upper_body|body_top/.test(category)) return 8;
  if (/からだ下|体下|ウデ|うで|腕|body_lower|lower_body|body_bottom|arms|hands/.test(category)) return 4;
  if (/アタマ|あたま|頭|足|脚|靴|head|feet|foot|shoes/.test(category)) return 2;
  return 0;
}

// Bounded scenario search, not a success-probability model. Unknown powers and
// unobserved cloth effects stop expansion instead of being silently guessed.
function planBranches(state, candidate) {
  const indices = candidate.affectedPreview.some(c => c.numbers) ? [0,3,6] : [0];
  return indices.map(index => {
    const values = { ...state.values }, bastingCells = { ...state.bastingCells };
    for (const item of candidate.affectedPreview) {
      if (candidate.skillKey === "basting") bastingCells[item.cellKey] = true;
      else if (item.numbers) {
        values[item.cellKey] = Math.max(0, item.current + item.numbers[index]);
        delete bastingCells[item.cellKey];
      }
    }
    const power = candidate.skillKey === "focus"
      ? { currentPower: state.currentPower, nextPower: state.nextPower, focusTurns: 3, heldPower: state.currentPower, powerQueue: state.powerQueue ?? [] }
      : advancePowerState(state, candidate.skillKey === "powerShift");
    return { ...state, ...power, values, bastingCells,
      mentalPower: state.mentalPower - candidate.effectiveCost, turnCount: state.turnCount + 1 };
  });
}

function finishingLoss(state) {
  const cells = validCells(state.grid, state.values);
  const error = cells.reduce((sum,c) => sum + Math.abs(c.diff),0);
  const target = state.tolerance;
  const floor = target + 6;
  // Minimum cost reserve is deliberately optimistic; it never claims reachability.
  const needingWork = cells.filter(c => Math.abs(c.diff) > 1);
  const reserve = needingWork.reduce((sum,c) => sum + (c.diff < 0 ? 16 : 5),0);
  const shortage = Math.max(0, reserve - state.mentalPower);
  return { error, worstError: error, uncertain: !POWER_ORDER.includes(state.currentPower) || (isClothEffectTurn(state.turnCount) && state.clothType !== "rainbow" && !state.clothEvents[String(state.turnCount)]), loss: Math.max(0,error-floor)*14 + Math.max(0,error-target)*4 + error
    + shortage*3 + cells.reduce((sum,c)=>sum+Math.max(0,-c.diff-1),0)*2 };
}

function evaluateContinuation(state, depth) {
  const here = finishingLoss(state);
  if (!depth || here.error <= state.tolerance || state.mentalPower <= 0 || !POWER_ORDER.includes(state.currentPower)) return here;
  // Recovery is an observed input, not a fabricated next board.
  if (state.clothType === "regen" && isClothEffectTurn(state.turnCount) && !state.clothEvents[String(state.turnCount)]) return here;
  const options = getGlobalOptimizedCandidates({ ...state, searchDepth: 0, limit: 4 });
  let best = here; // Finishing without another action is always a valid alternative.
  for (const option of options) {
    const leaves = planBranches(state, option).map(next => evaluateContinuation(next, depth-1));
    const loss = mean(leaves.map(x=>x.loss))*.65 + Math.max(...leaves.map(x=>x.loss))*.35;
    if (loss < best.loss) best = { loss, error: mean(leaves.map(x=>x.error)), worstError: Math.max(...leaves.map(x=>x.worstError)), uncertain: leaves.some(x=>x.uncertain) };
  }
  return best;
}

function rankFinishingPlans(candidates, state, cells) {
  const error = cells.reduce((sum,c)=>sum+Math.abs(c.diff),0);
  // Concentrate the search on the finishing phase; retain the opening budget policy.
  if (error > cells.length*24 || !candidates.length) return candidates;
  const before = finishingLoss(state);
  const pool = candidates.slice(0,12);
  const evaluated = pool.map(candidate => {
    const branches = planBranches(state,candidate);
    const leaves = branches.map(next => evaluateContinuation(next,2));
    const meanError = mean(leaves.map(x=>x.error));
    const worstError = Math.max(...leaves.map(x=>x.worstError));
    const loss = mean(leaves.map(x=>x.loss))*.65 + Math.max(...leaves.map(x=>x.loss))*.35;
    const uncertain = candidate.skillKey === "powerShift" || leaves.some(x=>x.uncertain);
    // Random changes cannot be valued as though they guaranteed a better power.
    const planScore = loss + candidate.effectiveCost*.1;
    const floor = state.tolerance+6;
    const assessment = uncertain ? "未確定のパワー・布効果があり再評価が必要" : worstError <= state.tolerance ? "検討した数値では大成功圏内" : worstError <= floor ? "検討した数値では最低目標内" : "最低目標を超える可能性あり";
    return { ...candidate, planScore, finishingPlan: { target: state.tolerance, fallback: floor,
      sampledMeanError: meanError, sampledWorstError: worstError, uncertain, assessment },
      reason: `${candidate.reason} 最大3手を比較：${assessment}（最低目標は合計誤差${floor}以下）。会心と全乱数の保証ではありません。` };
  });
  // Do not spend the last concentration to worsen a board already inside the fallback.
  if (before.error <= state.tolerance + 6 && evaluated.every(c => !c.finishingPlan.uncertain && c.finishingPlan.sampledMeanError >= before.error)) return [];
  evaluated.sort((a,b)=>a.planScore-b.planScore || a.score-b.score);
  // Preserve the requested escape option when all available sewing worsens the board.
  const shift = evaluated.find(c=>c.skillKey==="powerShift");
  if (shift && evaluated.every(c=>c.skillKey==="powerShift" || c.planScore >= before.loss)) {
    evaluated.splice(evaluated.indexOf(shift),1); evaluated.unshift(shift);
  }
  return [...evaluated,...candidates.slice(12)];
}
