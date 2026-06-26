

// ===== craftOptimizer.js =====
export const CLOTH_TYPES = [
  {
    key: "regen",
    label: "再生布",
    description: "4ターンごとにランダムなマスが12〜16回復します。",
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
  unknown: "?",
};

export const POWER_ORDER = ["weak", "normal", "strong", "super"];

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
    cost: 0,
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

function getCell(grid, rowIndex, colIndex) {
  if (!Array.isArray(grid)) return null;
  if (!grid[rowIndex]) return null;
  return grid[rowIndex][colIndex] ?? null;
}

function getCurrentValue(values, rowIndex, colIndex) {
  const value = values?.[getCellKey(rowIndex, colIndex)];

  if (value === "" || value === null || value === undefined) return 0;

  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function getDiff(grid, values, rowIndex, colIndex) {
  const cell = getCell(grid, rowIndex, colIndex);

  if (!cell || cell.target === null || Number.isNaN(Number(cell.target))) {
    return null;
  }

  return Number(cell.target) - getCurrentValue(values, rowIndex, colIndex);
}

function getRange(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return null;

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    avg: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
  };
}

function getSkillNumbers(skillKey, powerKey) {
  const skill = POWER_TABLES[skillKey];
  if (!skill) return null;

  const baseSkillKey = skill.baseSkillKey ?? skillKey;
  const baseSkill = POWER_TABLES[baseSkillKey];

  return baseSkill?.[powerKey] ?? null;
}

function isClothEffectTurn(turnCount) {
  const current = Number(turnCount || 1);
  // 素材特性は「4ターン経過後」に発生するため、最初は5ターン目。
  return current >= 5 && (current - 1) % 4 === 0;
}

function getCurrentClothEvent({ clothEvents, turnCount }) {
  return clothEvents?.[String(turnCount)] ?? null;
}

function getEffectiveCost({ baseCost, clothType, clothEvent, turnCount }) {
  const cost = Number(baseCost ?? 0);

  if (!cost) return 0;

  if (
    clothType === "rainbow" &&
    isClothEffectTurn(turnCount) &&
    clothEvent?.rainbowMode === "halfCost"
  ) {
    return Math.ceil(cost / 2);
  }

  if (
    clothType === "rainbow" &&
    isClothEffectTurn(turnCount) &&
    clothEvent?.rainbowMode === "critical"
  ) {
    return Math.ceil(cost * 1.5);
  }

  return cost;
}

function getClothRateModifier({
  clothType,
  clothEvent,
  turnCount,
  rowIndex,
  colIndex,
}) {
  if (!isClothEffectTurn(turnCount)) return 1;

  const cellKey = getCellKey(rowIndex, colIndex);

  if (
    clothType === "pink" &&
    Array.isArray(clothEvent?.cellKeys) &&
    clothEvent.cellKeys.includes(cellKey)
  ) {
    return 2;
  }

  return 1;
}

function getValidCells(grid, values) {
  const cells = [];

  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell || cell.target === null || Number.isNaN(Number(cell.target))) {
        return;
      }

      const current = getCurrentValue(values, rowIndex, colIndex);
      const target = Number(cell.target);
      const diff = target - current;

      cells.push({
        rowIndex,
        colIndex,
        cellKey: getCellKey(rowIndex, colIndex),
        target,
        current,
        diff,
      });
    });
  });

  return cells;
}

function getPositiveDiffSummary(grid, values) {
  let totalDiff = 0;
  let highDiffCells = 0;
  let mediumDiffCells = 0;
  let safeCells = 0;

  getValidCells(grid, values).forEach((cell) => {
    if (cell.diff > 0) {
      totalDiff += cell.diff;
      safeCells += 1;
      if (cell.diff >= 40) highDiffCells += 1;
      if (cell.diff >= 20) mediumDiffCells += 1;
    }
  });

  return {
    totalDiff,
    highDiffCells,
    mediumDiffCells,
    safeCells,
  };
}

function countRemainingCells(grid, values) {
  return getValidCells(grid, values).filter((cell) => cell.diff !== 0).length;
}

function validateAffectedCells({
  grid,
  values,
  rowIndex,
  colIndex,
  pattern,
  isRecover,
}) {
  const affected = [];

  for (const point of pattern.cells) {
    const r = rowIndex + point.dr;
    const c = colIndex + point.dc;
    const cell = getCell(grid, r, c);

    if (!cell || cell.target === null || Number.isNaN(Number(cell.target))) {
      return { ok: false, affected: [] };
    }

    const diff = getDiff(grid, values, r, c);

    if (diff === null) {
      return { ok: false, affected: [] };
    }

    if (!isRecover && diff <= 0) {
      return { ok: false, affected: [] };
    }

    if (isRecover && diff >= 0) {
      return { ok: false, affected: [] };
    }

    affected.push({
      rowIndex: r,
      colIndex: c,
      cellKey: getCellKey(r, c),
      diff,
      rate: point.rate,
      role: point.role ?? "normal",
    });
  }

  return { ok: true, affected };
}

function getNextPowerBonus({ nextPower, skillKey, currentPower }) {
  if (!nextPower || nextPower === "unknown") return 0;

  if ((nextPower === "strong" || nextPower === "super") && currentPower === "weak") {
    return skillKey === "adjust" || skillKey === "halfAdjust" ? -2 : 5;
  }

  if (
    (currentPower === "strong" || currentPower === "super") &&
    (nextPower === "weak" || nextPower === "normal")
  ) {
    return skillKey === "wrap" || skillKey === "level" || skillKey === "bigWaterfall"
      ? -8
      : -2;
  }

  if (nextPower === "super" && skillKey === "focus") return -6;

  return 0;
}

function scoreSkill({
  skillKey,
  pattern,
  grid,
  values,
  rowIndex,
  colIndex,
  currentPower,
  nextPower,
  mentalPower,
  turnCount,
  clothType,
  clothEvents,
}) {
  const skill = POWER_TABLES[skillKey];

  if (!skill) return null;
  if (skill.type === "support") return null;
  if (currentPower === "unknown") return null;

  const clothEvent = getCurrentClothEvent({ clothEvents, turnCount });
  const effectiveCost = getEffectiveCost({
    baseCost: skill.cost,
    clothType,
    clothEvent,
    turnCount,
  });

  if (effectiveCost > mentalPower) return null;

  const isRecover = skill.type === "singleRecover";
  const validation = validateAffectedCells({
    grid,
    values,
    rowIndex,
    colIndex,
    pattern,
    isRecover,
  });

  if (!validation.ok) return null;

  const numbers = getSkillNumbers(skillKey, currentPower);
  const range = getRange(numbers);

  if (!range) return null;

  let fitPenalty = 0;
  let overPenalty = 0;
  let shortagePenalty = 0;
  let clothBonus = 0;

  validation.affected.forEach((affected) => {
    const clothRate = getClothRateModifier({
      clothType,
      clothEvent,
      turnCount,
      rowIndex: affected.rowIndex,
      colIndex: affected.colIndex,
    });

    const finalRate = affected.rate * clothRate;
    const min = Math.round(range.min * finalRate);
    const max = Math.round(range.max * finalRate);
    const avg = Math.round(range.avg * finalRate);
    const diff = affected.diff;

    if (clothRate > 1) clothBonus -= 8;

    if (isRecover) {
      const recoverMin = Math.abs(max);
      const recoverMax = Math.abs(min);
      const over = Math.abs(diff);

      if (over >= recoverMin && over <= recoverMax) {
        fitPenalty += 0;
      } else {
        fitPenalty += Math.abs(over - Math.abs(avg));
      }
    } else {
      if (diff >= min && diff <= max) {
        fitPenalty += Math.abs(diff - avg) * 0.24;
      } else if (diff > max) {
        shortagePenalty += diff - max;
      } else {
        overPenalty += (min - diff) * 11;
      }
    }
  });

  const remainingCells = countRemainingCells(grid, values);
  const affectedCount = validation.affected.length;
  const remainingAfter = Math.max(0, remainingCells - affectedCount);
  const mentalAfter = mentalPower - effectiveCost;
  const minimumFutureCost = remainingAfter * 5;
  const mentalPenalty = Math.max(0, minimumFutureCost - mentalAfter) * 2.4;

  const costPressure =
    mentalPower <= 30
      ? effectiveCost * 1.2
      : mentalPower <= 60
        ? effectiveCost * 0.6
        : effectiveCost * 0.1;

  const multiBonus = affectedCount >= 2 ? affectedCount * -4 : 0;

  const strongMultiBonus =
    (currentPower === "strong" || currentPower === "super") && affectedCount >= 2
      ? -10
      : 0;

  const wrapCenterBonus =
    skillKey === "wrap" &&
    validation.affected.some((item) => item.role === "center" && item.diff >= 35)
      ? -12
      : 0;

  const nextPowerBonus = getNextPowerBonus({
    nextPower,
    skillKey,
    currentPower,
  });

  const score =
    fitPenalty +
    overPenalty +
    shortagePenalty +
    mentalPenalty +
    costPressure +
    multiBonus +
    strongMultiBonus +
    wrapCenterBonus +
    clothBonus +
    nextPowerBonus;

  const rangeLabel = validation.affected
    .map((affected) => {
      const clothRate = getClothRateModifier({
        clothType,
        clothEvent,
        turnCount,
        rowIndex: affected.rowIndex,
        colIndex: affected.colIndex,
      });

      const finalRate = affected.rate * clothRate;
      const min = Math.round(range.min * finalRate);
      const max = Math.round(range.max * finalRate);

      return min === max ? String(min) : `${min}〜${max}`;
    })
    .join(" / ");

  return {
    key: `${skillKey}-${rowIndex}-${colIndex}-${pattern.label || "single"}`,
    skillKey,
    label: pattern.label ? `${skill.label}（${pattern.label}）` : skill.label,
    baseLabel: skill.label,
    patternLabel: pattern.label,
    cost: skill.cost ?? 0,
    effectiveCost,
    score,
    range: rangeLabel,
    mentalAfter,
    affected: validation.affected,
  };
}

function buildCandidatePreview({
  candidate,
  grid,
  values,
  currentPower,
  clothType,
  clothEvents,
  turnCount,
}) {
  const skill = POWER_TABLES[candidate.skillKey];
  const numbers = getSkillNumbers(candidate.skillKey, currentPower);
  const range = getRange(numbers);
  const clothEvent = getCurrentClothEvent({ clothEvents, turnCount });

  if (!skill || !range) {
    return {
      affectedPreview: [],
      maxOverRate: 0,
      riskText: "",
      actionSummary: "",
    };
  }

  let maxOverRate = 0;

  const affectedPreview = candidate.affected.map((affected) => {
    const cell = getCell(grid, affected.rowIndex, affected.colIndex);
    const current = getCurrentValue(values, affected.rowIndex, affected.colIndex);
    const target = Number(cell?.target ?? 0);
    const diff = target - current;

    const clothRate = getClothRateModifier({
      clothType,
      clothEvent,
      turnCount,
      rowIndex: affected.rowIndex,
      colIndex: affected.colIndex,
    });

    const finalRate = affected.rate * clothRate;
    const possibleValues = numbers.map((value) =>
      Math.round(Number(value) * finalRate)
    );

    const min = Math.min(...possibleValues);
    const max = Math.max(...possibleValues);
    const avg =
      possibleValues.reduce((sum, value) => sum + value, 0) /
      possibleValues.length;

    let overCount = 0;

    if (skill.type !== "singleRecover") {
      overCount = possibleValues.filter((value) => value > diff).length;
    }

    const overRate = overCount / possibleValues.length;
    maxOverRate = Math.max(maxOverRate, overRate);

    return {
      rowIndex: affected.rowIndex,
      colIndex: affected.colIndex,
      cellKey: affected.cellKey,
      name: getCellDisplayName(affected.rowIndex, affected.colIndex),
      target,
      current,
      diff,
      min,
      max,
      avg: Math.round(avg),
      expectedCurrent:
        skill.type === "singleRecover"
          ? Math.max(0, current - Math.round(Math.abs(avg)))
          : current + Math.round(avg),
      overRate,
      isRecover: skill.type === "singleRecover",
      clothRate,
    };
  });

  const riskyCells = affectedPreview
    .filter((item) => item.overRate > 0)
    .map((item) => `${item.name} ${Math.round(item.overRate * 100)}%`);

  return {
    affectedPreview,
    maxOverRate,
    riskText:
      riskyCells.length > 0
        ? `ただし ${riskyCells.join(" / ")} の確率でオーバーの可能性あり`
        : "オーバーリスク低め",
    actionSummary: affectedPreview
      .map((item) => `${item.name}:${item.min}〜${item.max}`)
      .join(" / "),
  };
}

function buildRandomSewCandidate({
  grid,
  values,
  currentPower,
  nextPower,
  mentalPower,
  turnCount,
  clothType,
  clothEvents,
}) {
  if (currentPower === "unknown") return null;

  // 弱い乱れぬいはコスパが悪いので候補から除外。
  // 普通でもかなり限定的にし、強い・最強で残りが広く散っている時だけ出やすくする。
  if (currentPower === "weak") return null;

  const skill = POWER_TABLES.randomSew;
  const clothEvent = getCurrentClothEvent({ clothEvents, turnCount });
  const effectiveCost = getEffectiveCost({
    baseCost: skill.cost,
    clothType,
    clothEvent,
    turnCount,
  });

  if (effectiveCost > mentalPower) return null;

  const numbers = getSkillNumbers("noSkill", currentPower);
  const range = getRange(numbers);

  if (!range) return null;

  const positiveCells = getValidCells(grid, values)
    .filter((cell) => cell.diff > 0)
    .sort((a, b) => b.diff - a.diff);

  if (positiveCells.length < 5) return null;

  const summary = getPositiveDiffSummary(grid, values);

  if (currentPower === "normal" && summary.totalDiff < 95) return null;
  if (currentPower === "normal" && mentalPower < 55) return null;
  if ((currentPower === "strong" || currentPower === "super") && summary.totalDiff < 70) {
    return null;
  }

  const affected = positiveCells.slice(0, Math.min(6, positiveCells.length)).map(
    (cell) => ({
      rowIndex: cell.rowIndex,
      colIndex: cell.colIndex,
      cellKey: cell.cellKey,
      diff: cell.diff,
      rate: 0.65,
      role: "random",
    })
  );

  let maxOverRate = 0;

  const affectedPreview = affected.map((item) => {
    const current = getCurrentValue(values, item.rowIndex, item.colIndex);
    const cell = getCell(grid, item.rowIndex, item.colIndex);
    const target = Number(cell.target);
    const clothRate = getClothRateModifier({
      clothType,
      clothEvent,
      turnCount,
      rowIndex: item.rowIndex,
      colIndex: item.colIndex,
    });
    const finalRate = item.rate * clothRate;
    const possibleValues = numbers.map((value) =>
      Math.round(Number(value) * finalRate)
    );

    const min = Math.min(...possibleValues);
    const max = Math.max(...possibleValues);
    const avg = Math.round(
      possibleValues.reduce((sum, value) => sum + value, 0) /
        possibleValues.length
    );
    const overRate =
      possibleValues.filter((value) => value > target - current).length /
      possibleValues.length;

    maxOverRate = Math.max(maxOverRate, overRate);

    return {
      ...item,
      name: getCellDisplayName(item.rowIndex, item.colIndex),
      target,
      current,
      diff: target - current,
      min,
      max,
      avg,
      expectedCurrent: current + avg,
      overRate,
      isRecover: false,
      clothRate,
    };
  });

  const nextPowerPenalty =
    nextPower === "weak"
      ? 10
      : nextPower === "normal"
        ? 6
        : nextPower === "unknown"
          ? 4
          : 0;

  const weakCostPenalty = currentPower === "normal" ? 34 : 18;
  const mentalPenalty = mentalPower < 70 ? 20 : 0;

  const score =
    48 +
    weakCostPenalty +
    mentalPenalty +
    nextPowerPenalty -
    Math.min(18, summary.totalDiff / 18) +
    maxOverRate * (clothType === "regen" ? 34 : 95) +
    effectiveCost * 0.7;

  return {
    key: `randomSew-${turnCount}`,
    skillKey: "randomSew",
    label: "乱れぬい",
    baseLabel: "乱れぬい",
    patternLabel: "",
    cost: skill.cost,
    effectiveCost,
    score,
    globalScore: score,
    range: `${Math.round(range.min * 0.65)}〜${Math.round(range.max * 0.65)}`,
    mentalAfter: mentalPower - effectiveCost,
    affected,
    affectedPreview,
    rowIndex: null,
    colIndex: null,
    cellName: "ランダム",
    maxOverRate,
    riskText:
      "乱れぬいはランダム性が高いので、強い/最強で全体を削る時だけ候補にします",
    actionSummary: affectedPreview
      .map((item) => `${item.name}:${item.min}〜${item.max}`)
      .join(" / "),
  };
}

function buildFocusCandidate({
  grid,
  values,
  currentPower,
  nextPower,
  mentalPower,
  turnCount,
  clothType,
  clothEvents,
  focusTurns,
}) {
  if (focusTurns > 0) return null;
  if (!(currentPower === "strong" || currentPower === "super")) return null;

  const skill = POWER_TABLES.focus;
  const effectiveCost = getEffectiveCost({
    baseCost: skill.cost,
    clothType,
    clothEvent: getCurrentClothEvent({ clothEvents, turnCount }),
    turnCount,
  });

  if (effectiveCost > mentalPower) return null;

  const summary = getPositiveDiffSummary(grid, values);

  const shouldFocus =
    summary.safeCells >= 4 &&
    (summary.highDiffCells >= 1 ||
      summary.mediumDiffCells >= 3 ||
      summary.totalDiff >= 100);

  if (!shouldFocus) return null;

  const powerBonus = currentPower === "super" ? -36 : -28;
  const nextPowerBonus =
    nextPower === "weak" || nextPower === "normal" || nextPower === "unknown"
      ? -8
      : 4;

  const score =
    powerBonus -
    Math.min(22, summary.totalDiff / 8) +
    nextPowerBonus +
    effectiveCost * 0.15;

  return {
    key: `focus-${turnCount}`,
    skillKey: "focus",
    label: "精神統一",
    baseLabel: "精神統一",
    patternLabel: "",
    cost: skill.cost,
    effectiveCost,
    score,
    globalScore: score,
    range: "3ターン維持",
    mentalAfter: mentalPower - effectiveCost,
    affected: [],
    affectedPreview: [],
    rowIndex: null,
    colIndex: null,
    cellName: "全体",
    maxOverRate: 0,
    riskText: `${POWER_LABELS[currentPower]}を3ターン固定して、巻きこみぬい・水平ぬい・大滝のぼりを狙う`,
    actionSummary: `集中${effectiveCost} / 残${mentalPower - effectiveCost}`,
  };
}

function buildPowerShiftCandidate({
  grid,
  values,
  currentPower,
  mentalPower,
  turnCount,
  clothType,
  clothEvents,
}) {
  if (currentPower === "unknown") return null;

  const skill = POWER_TABLES.powerShift;
  const effectiveCost = getEffectiveCost({
    baseCost: skill.cost,
    clothType,
    clothEvent: getCurrentClothEvent({ clothEvents, turnCount }),
    turnCount,
  });

  if (effectiveCost > mentalPower) return null;

  const summary = getPositiveDiffSummary(grid, values);
  const shouldShift =
    currentPower === "weak" &&
    summary.totalDiff >= 70 &&
    mentalPower >= effectiveCost + summary.safeCells * 5;

  if (!shouldShift) return null;

  const score =
    -18 -
    Math.min(20, summary.totalDiff / 10) +
    effectiveCost * 0.35 +
    (mentalPower < 45 ? 24 : 0);

  return {
    key: `powerShift-${turnCount}`,
    skillKey: "powerShift",
    label: "ぬいパワーシフト",
    baseLabel: "ぬいパワーシフト",
    patternLabel: "",
    cost: skill.cost,
    effectiveCost,
    score,
    globalScore: score,
    range: "次パワー変更",
    mentalAfter: mentalPower - effectiveCost,
    affected: [],
    affectedPreview: [],
    rowIndex: null,
    colIndex: null,
    cellName: "全体",
    maxOverRate: 0,
    riskText: "弱いターンで残りが多い時、次のぬいパワー変更を狙います",
    actionSummary: `集中${effectiveCost} / 残${mentalPower - effectiveCost}`,
  };
}

function buildBastingCandidate({
  grid,
  values,
  currentPower,
  nextPower,
  mentalPower,
  turnCount,
  clothType,
  clothEvents,
}) {
  if (currentPower === "unknown") return null;

  const skill = POWER_TABLES.basting;
  const effectiveCost = getEffectiveCost({
    baseCost: skill.cost,
    clothType,
    clothEvent: getCurrentClothEvent({ clothEvents, turnCount }),
    turnCount,
  });

  if (effectiveCost > mentalPower) return null;
  if (!(nextPower === "strong" || nextPower === "super")) return null;

  const cells = getValidCells(grid, values)
    .filter((cell) => cell.diff >= 35)
    .sort((a, b) => b.diff - a.diff);

  if (cells.length === 0) return null;

  const target = cells[0];
  const score =
    -12 -
    Math.min(26, target.diff / 3) +
    (nextPower === "super" ? -10 : -4) +
    effectiveCost * 0.4 +
    (mentalPower < 50 ? 18 : 0);

  return {
    key: `basting-${turnCount}-${target.cellKey}`,
    skillKey: "basting",
    label: "しつけがけ",
    baseLabel: "しつけがけ",
    patternLabel: "",
    cost: skill.cost,
    effectiveCost,
    score,
    globalScore: score,
    range: "次の縫い2倍",
    mentalAfter: mentalPower - effectiveCost,
    affected: [
      {
        rowIndex: target.rowIndex,
        colIndex: target.colIndex,
        cellKey: target.cellKey,
        diff: target.diff,
        rate: 0,
        role: "support",
      },
    ],
    affectedPreview: [
      {
        rowIndex: target.rowIndex,
        colIndex: target.colIndex,
        cellKey: target.cellKey,
        name: getCellDisplayName(target.rowIndex, target.colIndex),
        target: target.target,
        current: target.current,
        diff: target.diff,
        min: 0,
        max: 0,
        avg: 0,
        expectedCurrent: target.current,
        overRate: 0,
        isRecover: false,
        clothRate: 1,
      },
    ],
    rowIndex: target.rowIndex,
    colIndex: target.colIndex,
    cellName: getCellDisplayName(target.rowIndex, target.colIndex),
    maxOverRate: 0,
    riskText: `${getCellDisplayName(target.rowIndex, target.colIndex)}を次の${POWER_LABELS[nextPower]}で大きく進める準備`,
    actionSummary: `集中${effectiveCost} / 残${mentalPower - effectiveCost}`,
  };
}

function getOptimizedCandidatesAtCell({
  grid,
  values,
  rowIndex,
  colIndex,
  currentPower,
  nextPower,
  mentalPower,
  turnCount,
  clothType,
  clothEvents,
}) {
  const candidates = [];

  Object.keys(PATTERN_DEFINITIONS).forEach((skillKey) => {
    const patterns = PATTERN_DEFINITIONS[skillKey];

    patterns.forEach((pattern) => {
      const candidate = scoreSkill({
        skillKey,
        pattern,
        grid,
        values,
        rowIndex,
        colIndex,
        currentPower,
        nextPower,
        mentalPower,
        turnCount,
        clothType,
        clothEvents,
      });

      if (candidate) candidates.push(candidate);
    });
  });

  return candidates;
}

export function getGlobalOptimizedCandidates({
  grid,
  values,
  currentPower,
  nextPower,
  mentalPower,
  turnCount = 1,
  clothType = "regen",
  clothEvents = {},
  focusTurns = 0,
  limit = 5,
}) {
  if (!Array.isArray(grid) || grid.length === 0) return [];
  if (currentPower === "unknown") return [];

  const allCandidates = [];

  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell || cell.target === null || Number.isNaN(Number(cell.target))) {
        return;
      }

      const candidates = getOptimizedCandidatesAtCell({
        grid,
        values,
        rowIndex,
        colIndex,
        currentPower,
        nextPower,
        mentalPower,
        turnCount,
        clothType,
        clothEvents,
      });

      candidates.forEach((candidate) => {
        const preview = buildCandidatePreview({
          candidate,
          grid,
          values,
          currentPower,
          clothType,
          clothEvents,
          turnCount,
        });

        const riskWeight =
          clothType === "regen" ? 14 : clothType === "pink" ? 74 : 64;

        const riskPenalty = preview.maxOverRate * riskWeight;

        const mentalPressure =
          mentalPower <= 30
            ? candidate.effectiveCost * 1.2
            : mentalPower <= 60
              ? candidate.effectiveCost * 0.65
              : candidate.effectiveCost * 0.12;

        const globalScore = candidate.score + riskPenalty + mentalPressure;

        allCandidates.push({
          ...candidate,
          ...preview,
          rowIndex,
          colIndex,
          cellName: getCellDisplayName(rowIndex, colIndex),
          globalScore,
        });
      });
    });
  });

  const randomCandidate = buildRandomSewCandidate({
    grid,
    values,
    currentPower,
    nextPower,
    mentalPower,
    turnCount,
    clothType,
    clothEvents,
  });

  if (randomCandidate) allCandidates.push(randomCandidate);

  const focusCandidate = buildFocusCandidate({
    grid,
    values,
    currentPower,
    nextPower,
    mentalPower,
    turnCount,
    clothType,
    clothEvents,
    focusTurns,
  });

  if (focusCandidate) allCandidates.push(focusCandidate);

  const powerShiftCandidate = buildPowerShiftCandidate({
    grid,
    values,
    currentPower,
    mentalPower,
    turnCount,
    clothType,
    clothEvents,
  });

  if (powerShiftCandidate) allCandidates.push(powerShiftCandidate);

  const bastingCandidate = buildBastingCandidate({
    grid,
    values,
    currentPower,
    nextPower,
    mentalPower,
    turnCount,
    clothType,
    clothEvents,
  });

  if (bastingCandidate) allCandidates.push(bastingCandidate);

  return allCandidates
    .sort((a, b) => {
      if (a.globalScore !== b.globalScore) return a.globalScore - b.globalScore;
      return a.effectiveCost - b.effectiveCost;
    })
    .slice(0, limit);
}

export function getPowerRangeLabel(skillKey, powerKey) {
  const numbers = getSkillNumbers(skillKey, powerKey);
  const range = getRange(numbers);

  if (!range) return "-";
  if (range.min === range.max) return String(range.min);

  return `${range.min}〜${range.max}`;
}
