"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWeightCheckerInitialData } from "@/lib/weightChecker";
import { fetchGameJobs } from "@/lib/gameJobs";
import { fetchEquipmentTypes } from "@/lib/equipmentTypes";
import PageHeroTitle from "@/components/PageHeroTitle";
import BossJudgeSection from "./BossJudgeSection";
import styles from "./WeightCheckerClient.module.css";

/**
 * ここを調整すれば、職業・武器ルールを変更しやすい。
 */
const HAND_RULE_CONFIG = {
  dualWieldJobs: [
    "バトルマスター",
    "バトマス",
    "battle_master",
    "battlemaster",
    "battle-master",
    "踊り子",
    "dancer",
  ],

  allWeaponTypes: [
    "片手剣",
    "両手剣",
    "短剣",
    "スティック",
    "両手杖",
    "ヤリ",
    "オノ",
    "棍",
    "ツメ",
    "ムチ",
    "扇",
    "ハンマー",
    "ブーメラン",
    "弓",
    "鎌",
  ],

  dualWieldWeaponTypes: [
    "片手剣",
    "短剣",
    "スティック",
    "扇",
    "ハンマー",
    "ブーメラン",
  ],

  shieldAllowedWeaponTypesForNormalJobs: ["片手剣", "ブーメラン", "ハンマー"],
};

const ITEM_SLOTS = [
  { key: "right_hand", label: "右手", source: "equipment", bonusLabel: "錬金" },
  { key: "left_hand", label: "左手", source: "equipment", bonusLabel: "錬金" },
  { key: "shield", label: "盾", source: "equipment", bonusLabel: "錬金" },

  { key: "head", label: "頭", source: "equipment", armor: true, bonusLabel: "錬金" },
  { key: "body_top", label: "体上", source: "equipment", armor: true, bonusLabel: "錬金" },
  { key: "body_bottom", label: "体下", source: "equipment", armor: true, bonusLabel: "錬金" },
  { key: "arms", label: "腕", source: "equipment", armor: true, bonusLabel: "錬金" },
  { key: "feet", label: "足", source: "equipment", armor: true, bonusLabel: "錬金" },

  { key: "face", label: "顔アクセ", source: "accessory", bonusLabel: "合成" },
  { key: "neck", label: "首アクセ", source: "accessory", bonusLabel: "合成" },
  { key: "ring", label: "指アクセ", source: "accessory", bonusLabel: "合成" },
  { key: "chest", label: "胸アクセ", source: "accessory", bonusLabel: "合成" },
  { key: "waist", label: "腰アクセ", source: "accessory", bonusLabel: "合成" },
  { key: "card", label: "札アクセ", source: "accessory", bonusLabel: "合成" },
  { key: "other", label: "他アクセ", source: "accessory", bonusLabel: "合成" },
  { key: "crest", label: "紋章", source: "accessory", bonusLabel: "合成" },
  { key: "proof", label: "証", source: "accessory", bonusLabel: "合成" },
];

const ARMOR_SLOT_KEYS = ["head", "body_top", "body_bottom", "arms", "feet"];

const FOOD_OPTIONS = [
  { value: 0, label: "なし" },
  { value: 5, label: "★0 +5" },
  { value: 7, label: "★ +7" },
  { value: 10, label: "★★ +10" },
  { value: 15, label: "★★★ +15" },
];

const HEAVY_CHARGE_OPTIONS = [
  { value: 1, label: "なし" },
  { value: 1.5, label: "ズッシード ✕1.5" },
  { value: 2.5, label: "ヘビーチャージ ✕2.5" },
];

const MAX_VALUES = {
  hakuaSkillWeight: 20,
  funbariOrbWeight: 6,
  kindanOrbWeight: 6,
  seedWeight: 5,
  goddessTreeWeight: 33,
};

const CHARGE_TARGET_CONFIG = [
  {
    key: "baseWeight",
    label: "基礎おもさ",
    defaultEnabled: true,
  },
  {
    key: "equipmentWeight",
    label: "装備本体",
    defaultEnabled: true,
  },
  {
    key: "hakuaSkillWeight",
    label: "はくあい",
    defaultEnabled: false,
  },
  {
    key: "growthWeight",
    label: "タネ・女神の木",
    defaultEnabled: true,
  },
  {
    key: "foodWeight",
    label: "ごはん",
    defaultEnabled: false,
  },
  {
    key: "orbWeight",
    label: "宝珠",
    defaultEnabled: false,
  },
  {
    key: "itemBonusWeight",
    label: "錬金・合成",
    defaultEnabled: false,
  },
  {
    key: "setBonusWeight",
    label: "セット効果",
    defaultEnabled: false,
  },
];

const SLOT_ALIASES = {
  head: ["head", "helmet", "helm", "頭", "アタマ"],
  body_top: ["body_top", "upper_body", "体上", "からだ上"],
  body_bottom: ["body_bottom", "lower_body", "体下", "からだ下"],
  arms: ["arms", "gloves", "hands", "腕", "ウデ"],
  feet: ["feet", "boots", "shoes", "足"],

  face: ["face", "顔", "顔アクセ", "顔アクセサリー"],
  neck: ["neck", "首", "首アクセ", "首アクセサリー"],
  ring: ["ring", "finger", "指", "指アクセ", "指アクセサリー"],
  chest: ["chest", "breast", "胸", "胸アクセ", "胸アクセサリー"],
  waist: ["waist", "belt", "腰", "腰アクセ", "腰アクセサリー"],
  card: ["card", "札", "札アクセ", "札アクセサリー"],
  other: ["other", "他", "その他", "他アクセ", "その他アクセ", "その他アクセサリー"],
  crest: ["crest", "紋章"],
  proof: ["proof", "証"],
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toKatakana(value) {
  return String(value || "").replace(/[\u3041-\u3096]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) + 0x60);
  });
}

function normalizeText(value) {
  return toKatakana(String(value || ""))
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function itemSlotText(item) {
  return normalizeText(
    [
      item.slot,
      item.slotGridType,
      item.groupKind,
      item.accessoryType,
      item.equipmentType?.key,
      item.equipmentType?.name,
      item.equipmentType?.kind,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function itemSearchText(item) {
  return normalizeText(
    [
      item.name,
      item.nameEn,
      item.itemId,
      item.slot,
      item.slotGridType,
      item.accessoryType,
      item.groupName,
      item.groupId,
      item.groupKind,
      item.equipmentType?.key,
      item.equipmentType?.name,
      item.equipmentType?.kind,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function extractWeightBonusFromEffects(effects = []) {
  if (!Array.isArray(effects)) return 0;

  return effects.reduce((sum, effect) => {
    const text = String(effect || "");
    const match = text.match(/(?:おもさ|重さ)\s*\+?\s*(\d+)/);

    if (!match) return sum;

    return sum + toNumber(match[1]);
  }, 0);
}

function getWeaponType(item) {
  const text = itemSlotText(item);

  return HAND_RULE_CONFIG.allWeaponTypes.find((weaponType) => {
    return text.includes(normalizeText(weaponType));
  });
}

function isShieldItem(item) {
  const text = itemSlotText(item);

  return ["盾", "大盾", "小盾", "shield"].some((keyword) => {
    return text.includes(normalizeText(keyword));
  });
}

function isWeaponItem(item) {
  if (isShieldItem(item)) {
    return false;
  }

  return Boolean(getWeaponType(item));
}

function isDualWieldWeaponItem(item) {
  if (isShieldItem(item)) {
    return false;
  }

  const weaponType = getWeaponType(item);

  return HAND_RULE_CONFIG.dualWieldWeaponTypes.some((allowedType) => {
    return normalizeText(allowedType) === normalizeText(weaponType);
  });
}

function isShieldAllowedWithWeapon(item) {
  if (!item) {
    return true;
  }

  const weaponType = getWeaponType(item);

  return HAND_RULE_CONFIG.shieldAllowedWeaponTypesForNormalJobs.some((allowedType) => {
    return normalizeText(allowedType) === normalizeText(weaponType);
  });
}

function isDualWieldJob(job) {
  if (!job) {
    return false;
  }

  const text = normalizeText([job.name, job.key].filter(Boolean).join(" "));

  return HAND_RULE_CONFIG.dualWieldJobs.some((keyword) => {
    return text.includes(normalizeText(keyword));
  });
}

function isSameSlot(item, slotKey) {
  if (slotKey === "right_hand") {
    return isWeaponItem(item);
  }

  if (slotKey === "left_hand") {
    return isDualWieldWeaponItem(item);
  }

  if (slotKey === "shield") {
    return isShieldItem(item);
  }

  const text = itemSlotText(item);
  const aliases = SLOT_ALIASES[slotKey] || [slotKey];

  return aliases.some((alias) => {
    return text.includes(normalizeText(alias));
  });
}

function isArmorItem(item) {
  return (
    item.source === "equipment" &&
    ARMOR_SLOT_KEYS.some((slotKey) => isSameSlot(item, slotKey))
  );
}

function getArmorSlotKey(item) {
  return ARMOR_SLOT_KEYS.find((slotKey) => isSameSlot(item, slotKey)) || "";
}

function getSetKey(item) {
  return item.groupId || item.groupName || "";
}

function getSetName(item) {
  return item.groupName || item.groupId || "";
}

function NumberField({ label, value, max, onChange, onMax }) {
  return (
    <label className={styles.compactNumberField}>
      <span>{label}</span>

      <input
        type="number"
        inputMode="numeric"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />

      <button type="button" onClick={onMax}>
        最大
      </button>
    </label>
  );
}

function SearchableItemPicker({
  slotKey,
  label,
  items,
  selectedItem,
  searchKeyword,
  bonusLabel,
  bonusValue,
  onBonusChange,
  onSearchChange,
  onSelect,
  onClear,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);

  const filteredItems = useMemo(() => {
    const keyword = normalizeText(searchKeyword);

    const result = items.filter((item) => {
      if (!keyword) return true;
      return itemSearchText(item).includes(keyword);
    });

    return result.slice(0, 30);
  }, [items, searchKeyword]);

  return (
    <div className={styles.itemPicker}>
      <div className={styles.itemPickerTop}>
        <div className={styles.slotLabel}>{label}</div>

        <div className={styles.itemPickerMain}>
          <div className={styles.itemPickerInputWrap}>
            <input
                ref={inputRef}
                type="search"
                value={searchKeyword}
              onFocus={() => setIsOpen(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  setIsOpen(false);
                }, 120);
              }}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setIsOpen(true);
              }}
              placeholder={
                items.length > 0
                  ? `${label}を検索`
                  : `${label}: 候補なし / slot確認`
              }
            />

            {selectedItem && (
              <>
                <span className={styles.weightPill}>
                  {selectedItem.weight || 0}
                </span>

                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={onClear}
                  aria-label={`${label}を解除`}
                >
                  ×
                </button>
              </>
            )}

            {isOpen && filteredItems.length > 0 && (
              <div className={styles.itemSuggestionList}>
                {filteredItems.map((item) => (
                  <button
                    key={`${slotKey}-${item.id}`}
                    type="button"
                    className={styles.itemSuggestionButton}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(item);
                      setIsOpen(false);

                      window.setTimeout(() => {
                        inputRef.current?.blur();
                      }, 0);
                    }}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        おもさ {item.weight || 0}
                        {item.equipLevel ? ` / Lv ${item.equipLevel}` : ""}
                      </small>
                    </span>

                    <em>{item.source === "accessory" ? "アクセ" : "装備"}</em>
                  </button>
                ))}
              </div>
            )}

            {isOpen && searchKeyword && filteredItems.length === 0 && (
              <div className={styles.itemSuggestionEmpty}>
                候補が見つからない
              </div>
            )}
          </div>
        </div>

        <label className={styles.bonusField}>
          <span>{bonusLabel}</span>
          <input
            type="number"
            inputMode="numeric"
            value={bonusValue || ""}
            onChange={(e) => onBonusChange(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>
    </div>
  );
}

export default function WeightCheckerClient() {
  const [equipments, setEquipments] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [bosses, setBosses] = useState([]);

  const [gameJobs, setGameJobs] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [selectedGameJobId, setSelectedGameJobId] = useState("");

  const [selectedItemIds, setSelectedItemIds] = useState({});

  const [baseWeight, setBaseWeight] = useState("");
  const [hakuaSkillWeight, setHakuaSkillWeight] = useState("");
  const [funbariOrbWeight, setFunbariOrbWeight] = useState("");
  const [kindanOrbWeight, setKindanOrbWeight] = useState("");
  const [seedWeight, setSeedWeight] = useState("");
  const [goddessTreeWeight, setGoddessTreeWeight] = useState("");

  const [foodWeight, setFoodWeight] = useState(0);
  const [heavyChargeRate, setHeavyChargeRate] = useState(1);
  const [useWeightBreak, setUseWeightBreak] = useState(false);

  const [setSearchKeyword, setSetSearchKeyword] = useState("");
  const [isSetSuggestionOpen, setIsSetSuggestionOpen] = useState(false);

  const [itemSearchKeywords, setItemSearchKeywords] = useState({});
  const [itemBonusWeights, setItemBonusWeights] = useState({});

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [chargeTargetSettings] = useState(() => {
    return CHARGE_TARGET_CONFIG.reduce((acc, item) => {
      acc[item.key] = item.defaultEnabled;
      return acc;
    }, {});
  });

  useEffect(() => {
    async function fetchInitialData() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const [data, jobData, equipmentTypeData] = await Promise.all([
          fetchWeightCheckerInitialData(),
          fetchGameJobs(),
          fetchEquipmentTypes(),
        ]);

        setEquipments(data.equipments || []);
        setAccessories(data.accessories || []);
        setBosses(data.bosses || []);
        setGameJobs(jobData || []);
        setEquipmentTypes(equipmentTypeData || []);
      } catch (error) {
        console.error(error);
        setErrorMessage(error.message || "データの取得に失敗しました。");
      } finally {
        setIsLoading(false);
      }
    }

    fetchInitialData();
  }, []);

  const selectedGameJob = useMemo(() => {
    return gameJobs.find((job) => String(job.id) === String(selectedGameJobId));
  }, [gameJobs, selectedGameJobId]);

  const canDualWield = useMemo(() => {
    return isDualWieldJob(selectedGameJob);
  }, [selectedGameJob]);

  const allItems = useMemo(() => {
    return [...equipments, ...accessories];
  }, [equipments, accessories]);

  const equipableEquipmentTypeIds = useMemo(() => {
    if (!selectedGameJobId) {
      return null;
    }

    const ids = new Set();

    equipmentTypes.forEach((equipmentType) => {
      const canEquip = equipmentType.equipableTypes?.some((equipableType) => {
        return String(equipableType.gameJobId) === String(selectedGameJobId);
      });

      if (canEquip) {
        ids.add(Number(equipmentType.id));
      }
    });

    return ids;
  }, [equipmentTypes, selectedGameJobId]);

  function canEquipBySelectedJob(item) {
    if (!equipableEquipmentTypeIds) {
      return true;
    }

    if (item.source !== "equipment") {
      return true;
    }

    if (!item.equipmentTypeId) {
      return false;
    }

    return equipableEquipmentTypeIds.has(Number(item.equipmentTypeId));
  }

  const armorSetSuggestions = useMemo(() => {
    const map = new Map();

    equipments.forEach((item) => {
      if (!canEquipBySelectedJob(item)) return;
      if (!isArmorItem(item)) return;

      const setKey = getSetKey(item);
      const setName = getSetName(item);

      if (!setKey || !setName) return;

      if (!map.has(setKey)) {
        map.set(setKey, {
          setKey,
          setName,
          equipLevel: item.equipLevel,
          items: [],
          slots: new Set(),
        });
      }

      const group = map.get(setKey);
      const slotKey = getArmorSlotKey(item);

      group.items.push(item);

      if (slotKey) {
        group.slots.add(slotKey);
      }

      group.equipLevel = Math.max(
        toNumber(group.equipLevel),
        toNumber(item.equipLevel)
      );
    });

    const keyword = normalizeText(setSearchKeyword);

    return [...map.values()]
      .map((group) => ({
        ...group,
        slotCount: group.slots.size,
      }))
      .filter((group) => {
        if (!keyword) return true;

        const searchText = normalizeText(
          [
            group.setName,
            group.setKey,
            group.equipLevel,
            ...group.items.map((item) => item.name),
          ]
            .filter(Boolean)
            .join(" ")
        );

        return searchText.includes(keyword);
      })
      .sort((a, b) => {
        if (toNumber(b.equipLevel) !== toNumber(a.equipLevel)) {
          return toNumber(b.equipLevel) - toNumber(a.equipLevel);
        }

        return b.slotCount - a.slotCount;
      })
      .slice(0, 12);
  }, [equipments, setSearchKeyword, equipableEquipmentTypeIds]);

  const selectedRightHandItem = useMemo(() => {
    return allItems.find(
      (item) => String(item.id) === String(selectedItemIds.right_hand)
    );
  }, [allItems, selectedItemIds.right_hand]);

  const leftHandSelected = Boolean(selectedItemIds.left_hand);
  const rightHandAllowsShield = isShieldAllowedWithWeapon(selectedRightHandItem);

  const visibleItemSlots = useMemo(() => {
    return ITEM_SLOTS.filter((slot) => {
      if (slot.key === "left_hand") {
        return canDualWield;
      }

      if (slot.key === "shield") {
        if (canDualWield) return false;
        if (leftHandSelected) return false;
        return rightHandAllowsShield;
      }

      return true;
    });
  }, [canDualWield, leftHandSelected, rightHandAllowsShield]);

  const itemsBySlot = useMemo(() => {
    return ITEM_SLOTS.reduce((acc, slot) => {
      acc[slot.key] = allItems
        .filter((item) => {
          if (slot.source && item.source !== slot.source) return false;
          if (!canEquipBySelectedJob(item)) return false;

          if (slot.key === "left_hand" && !canDualWield) {
            return false;
          }

          return isSameSlot(item, slot.key);
        })
        .sort((a, b) => {
          if (toNumber(b.equipLevel) !== toNumber(a.equipLevel)) {
            return toNumber(b.equipLevel) - toNumber(a.equipLevel);
          }

          return toNumber(b.weight) - toNumber(a.weight);
        });

      return acc;
    }, {});
  }, [allItems, equipableEquipmentTypeIds, canDualWield]);

  const selectedItems = useMemo(() => {
    return Object.values(selectedItemIds)
      .map((id) => {
        return allItems.find((item) => String(item.id) === String(id));
      })
      .filter(Boolean);
  }, [selectedItemIds, allItems]);

  const activeSetBonuses = useMemo(() => {
    const armorGroups = new Map();

    equipments.forEach((item) => {
      if (!isArmorItem(item)) return;

      const groupKey = getSetKey(item);
      const groupName = getSetName(item);

      if (!groupKey || !groupName) return;

      if (!armorGroups.has(groupKey)) {
        armorGroups.set(groupKey, {
          groupKey,
          groupName,
          allSlotKeys: new Set(),
          effects: item.effects || [],
        });
      }

      const group = armorGroups.get(groupKey);
      const slotKey = getArmorSlotKey(item);

      if (slotKey) {
        group.allSlotKeys.add(slotKey);
      }

      if (!group.effects?.length && item.effects?.length) {
        group.effects = item.effects;
      }
    });

    const selectedArmorGroups = new Map();

    selectedItems.forEach((item) => {
      if (!isArmorItem(item)) return;

      const groupKey = getSetKey(item);
      const groupName = getSetName(item);

      if (!groupKey || !groupName) return;

      if (!selectedArmorGroups.has(groupKey)) {
        selectedArmorGroups.set(groupKey, {
          groupKey,
          groupName,
          selectedSlotKeys: new Set(),
          effects: item.effects || [],
        });
      }

      const group = selectedArmorGroups.get(groupKey);
      const slotKey = getArmorSlotKey(item);

      if (slotKey) {
        group.selectedSlotKeys.add(slotKey);
      }

      if (!group.effects?.length && item.effects?.length) {
        group.effects = item.effects;
      }
    });

    return [...selectedArmorGroups.values()]
      .map((selectedGroup) => {
        const masterGroup = armorGroups.get(selectedGroup.groupKey);

        const requiredCount = masterGroup?.allSlotKeys?.size || 0;
        const selectedCount = selectedGroup.selectedSlotKeys.size;

        const weightBonus = extractWeightBonusFromEffects(
          selectedGroup.effects || masterGroup?.effects || []
        );

        const isActive =
          requiredCount > 0 &&
          selectedCount >= requiredCount &&
          weightBonus > 0;

        return {
          groupKey: selectedGroup.groupKey,
          groupName: selectedGroup.groupName,
          requiredCount,
          selectedCount,
          weightBonus,
          isActive,
        };
      })
      .filter((bonus) => bonus.weightBonus > 0);
  }, [equipments, selectedItems]);

  const equipmentWeight = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      return sum + toNumber(item.weight);
    }, 0);
  }, [selectedItems]);

  const itemBonusWeight = useMemo(() => {
    return Object.values(itemBonusWeights).reduce((sum, value) => {
      return sum + toNumber(value);
    }, 0);
  }, [itemBonusWeights]);

  const setBonusWeight = useMemo(() => {
    return activeSetBonuses.reduce((sum, bonus) => {
      if (!bonus.isActive) return sum;
      return sum + toNumber(bonus.weightBonus);
    }, 0);
  }, [activeSetBonuses]);

  const skillWeight = useMemo(() => {
    return toNumber(hakuaSkillWeight);
  }, [hakuaSkillWeight]);

  const orbWeight = useMemo(() => {
    return toNumber(funbariOrbWeight) + toNumber(kindanOrbWeight);
  }, [funbariOrbWeight, kindanOrbWeight]);

  const growthWeight = useMemo(() => {
    return toNumber(seedWeight) + toNumber(goddessTreeWeight);
  }, [seedWeight, goddessTreeWeight]);

  const weightParts = useMemo(() => {
    return {
      baseWeight: toNumber(baseWeight),
      equipmentWeight,
      hakuaSkillWeight: skillWeight,
      growthWeight,
      foodWeight: toNumber(foodWeight),
      orbWeight,
      itemBonusWeight,
      setBonusWeight,
    };
  }, [
    baseWeight,
    equipmentWeight,
    skillWeight,
    growthWeight,
    foodWeight,
    orbWeight,
    itemBonusWeight,
    setBonusWeight,
  ]);

  const chargeTargetWeight = useMemo(() => {
    return CHARGE_TARGET_CONFIG.reduce((sum, item) => {
      if (!chargeTargetSettings[item.key]) return sum;
      return sum + toNumber(weightParts[item.key]);
    }, 0);
  }, [chargeTargetSettings, weightParts]);

  const fixedBonusWeight = useMemo(() => {
    return CHARGE_TARGET_CONFIG.reduce((sum, item) => {
      if (chargeTargetSettings[item.key]) return sum;
      return sum + toNumber(weightParts[item.key]);
    }, 0);
  }, [chargeTargetSettings, weightParts]);

  const chargedWeight = useMemo(() => {
    return Math.floor(chargeTargetWeight * toNumber(heavyChargeRate));
  }, [chargeTargetWeight, heavyChargeRate]);

  const finalWeight = useMemo(() => {
    return chargedWeight + fixedBonusWeight;
  }, [chargedWeight, fixedBonusWeight]);

  const pushableCount = useMemo(() => {
    return bosses
      .flatMap((boss) => boss.pushWeights || [])
      .filter((push) => {
        const winWeight = useWeightBreak
          ? Math.ceil(toNumber(push.winWeight) / 2)
          : toNumber(push.winWeight);

        return winWeight > 0 && finalWeight >= winWeight;
      }).length;
  }, [bosses, finalWeight, useWeightBreak]);

  function clearSlot(slotKey) {
    setSelectedItemIds((prev) => ({
      ...prev,
      [slotKey]: "",
    }));

    setItemSearchKeywords((prev) => ({
      ...prev,
      [slotKey]: "",
    }));

    setItemBonusWeights((prev) => ({
      ...prev,
      [slotKey]: "",
    }));
  }

  function handleSelectItem(slotKey, itemId) {
    const selectedItem = allItems.find((item) => String(item.id) === String(itemId));

    setSelectedItemIds((prev) => {
      const next = {
        ...prev,
        [slotKey]: itemId,
      };

      if (slotKey === "right_hand") {
        if (canDualWield) {
          next.shield = "";
        } else {
          next.left_hand = "";

          if (selectedItem && !isShieldAllowedWithWeapon(selectedItem)) {
            next.shield = "";
          }
        }
      }

      if (slotKey === "left_hand" && itemId) {
        next.shield = "";
      }

      if (slotKey === "shield" && itemId) {
        next.left_hand = "";
      }

      return next;
    });

    if (slotKey === "right_hand") {
      if (canDualWield) {
        clearSlot("shield");
      } else {
        clearSlot("left_hand");

        if (selectedItem && !isShieldAllowedWithWeapon(selectedItem)) {
          clearSlot("shield");
        }
      }
    }

    if (slotKey === "left_hand" && itemId) {
      clearSlot("shield");
    }

    if (slotKey === "shield" && itemId) {
      clearSlot("left_hand");
    }
  }

  function applyArmorSet(group) {
    const next = { ...selectedItemIds };
    const nextSearchKeywords = { ...itemSearchKeywords };

    ARMOR_SLOT_KEYS.forEach((slotKey) => {
      const candidates = group.items
        .filter((item) => isSameSlot(item, slotKey))
        .sort((a, b) => {
          if (toNumber(b.equipLevel) !== toNumber(a.equipLevel)) {
            return toNumber(b.equipLevel) - toNumber(a.equipLevel);
          }

          return toNumber(b.weight) - toNumber(a.weight);
        });

      if (candidates[0]) {
        next[slotKey] = candidates[0].id;
        nextSearchKeywords[slotKey] = candidates[0].name;
      }
    });

    setSelectedItemIds(next);
    setItemSearchKeywords(nextSearchKeywords);
    setSetSearchKeyword(group.setName);
    setIsSetSuggestionOpen(false);
  }

  function setAllMax() {
    setHakuaSkillWeight(MAX_VALUES.hakuaSkillWeight);
    setFunbariOrbWeight(MAX_VALUES.funbariOrbWeight);
    setKindanOrbWeight(MAX_VALUES.kindanOrbWeight);
    setSeedWeight(MAX_VALUES.seedWeight);
    setGoddessTreeWeight(MAX_VALUES.goddessTreeWeight);
  }

  function handleReset() {
    setSelectedItemIds({});
    setBaseWeight("");
    setHakuaSkillWeight("");
    setFunbariOrbWeight("");
    setKindanOrbWeight("");
    setSeedWeight("");
    setGoddessTreeWeight("");
    setFoodWeight(0);
    setHeavyChargeRate(1);
    setUseWeightBreak(false);
    setSetSearchKeyword("");
    setIsSetSuggestionOpen(false);
    setItemSearchKeywords({});
    setItemBonusWeights({});
    setSelectedGameJobId("");
  }

  return (
    <main className={styles.weightCheckerPage}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <PageHeroTitle
            kicker="DQX Tools"
            title="おもさチェッカー"
            maxWidth="100%"
            margin="0"
            padding="0"
          />

          <p className={styles.lead}>
            装備・アクセ・スキル・宝珠・タネ・女神の木・ごはんを合計して、
            ボスごとの押し合いラインを確認できるドラクエ10向けツールです。
          </p>

          <div className={styles.featureList}>
            <span>装備おもさ計算</span>
            <span>職業別装備フィルター</span>
            <span>ボス押し勝ち判定</span>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <span>最終おもさ</span>
          <strong>{finalWeight}</strong>
          <small>
            対象 {chargeTargetWeight} × {heavyChargeRate} + 固定 {fixedBonusWeight}
          </small>
        </div>
      </section>

      {errorMessage && <div className={styles.errorBox}>{errorMessage}</div>}

      <section className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>最終おもさ</span>
          <strong>{finalWeight}</strong>
          <small>ボス判定に使う値</small>
        </div>

        <div className={styles.summaryCard}>
          <span>装備・アクセおもさ</span>
          <strong>{equipmentWeight + itemBonusWeight + setBonusWeight}</strong>
          <small>
            本体 {equipmentWeight} / 錬金・合成 {itemBonusWeight} / セット {setBonusWeight}
          </small>
        </div>

        <div className={styles.summaryCard}>
          <span>スキル・成長・宝珠・ごはん</span>
          <strong>
            {skillWeight + growthWeight + orbWeight + toNumber(foodWeight)}
          </strong>
          <small>
            はくあい {skillWeight} / 成長 {growthWeight} / 宝珠 {orbWeight} / ごはん {foodWeight}
          </small>
        </div>

        <div className={styles.summaryCard}>
          <span>押勝以上</span>
          <strong>{pushableCount}</strong>
          <small>登録ボスデータから算出</small>
        </div>
      </section>

      <section className={styles.layoutGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>ステータス・補正</h2>

            <div className={styles.buttonGroup}>
              <button type="button" onClick={setAllMax}>
                最大値
              </button>
              <button type="button" onClick={handleReset}>
                リセット
              </button>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3>基本</h3>

            <div className={styles.inputGrid}>
              <label className={styles.fieldLabel}>
                基礎おもさ
                <input
                  type="number"
                  inputMode="numeric"
                  value={baseWeight}
                  onChange={(e) => setBaseWeight(e.target.value)}
                  placeholder="例: 300"
                />
              </label>

              <label className={styles.fieldLabel}>
                ごはん(ヘビチャ対象外)
                <select
                  value={foodWeight}
                  onChange={(e) => setFoodWeight(Number(e.target.value))}
                >
                  {FOOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldLabel}>
                ヘビチャ / ズッシード
                <select
                  value={heavyChargeRate}
                  onChange={(e) => setHeavyChargeRate(Number(e.target.value))}
                >
                  {HEAVY_CHARGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3>スキル</h3>

            <div className={styles.inputGrid}>
              <NumberField
                label="はくあい"
                value={hakuaSkillWeight}
                max={MAX_VALUES.hakuaSkillWeight}
                onChange={setHakuaSkillWeight}
                onMax={() => setHakuaSkillWeight(MAX_VALUES.hakuaSkillWeight)}
              />
            </div>
          </div>

          <div className={styles.formSection}>
            <h3>宝珠(ヘビチャ対象外)</h3>

            <div className={styles.inputGrid}>
              <NumberField
                label="ふんばり魂"
                value={funbariOrbWeight}
                max={MAX_VALUES.funbariOrbWeight}
                onChange={setFunbariOrbWeight}
                onMax={() => setFunbariOrbWeight(MAX_VALUES.funbariOrbWeight)}
              />

              <NumberField
                label="禁断のおもさアップ"
                value={kindanOrbWeight}
                max={MAX_VALUES.kindanOrbWeight}
                onChange={setKindanOrbWeight}
                onMax={() => setKindanOrbWeight(MAX_VALUES.kindanOrbWeight)}
              />
            </div>
          </div>

          <div className={styles.formSection}>
            <h3>成長要素</h3>

            <div className={styles.inputGrid}>
              <NumberField
                label="タネ"
                value={seedWeight}
                max={MAX_VALUES.seedWeight}
                onChange={setSeedWeight}
                onMax={() => setSeedWeight(MAX_VALUES.seedWeight)}
              />

              <NumberField
                label="女神の木"
                value={goddessTreeWeight}
                max={MAX_VALUES.goddessTreeWeight}
                onChange={setGoddessTreeWeight}
                onMax={() => setGoddessTreeWeight(MAX_VALUES.goddessTreeWeight)}
              />
            </div>
          </div>

          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={useWeightBreak}
              onChange={(e) => setUseWeightBreak(e.target.checked)}
            />
              ウェイトブレイク中として判定する（ボスのおもさ半分）
          </label>
        </div>

        <div className={`${styles.panel} ${styles.equipmentPanel}`}>
          <div className={styles.panelHeader}>
            <h2>装備選択</h2>
            <span>
              {isLoading
                ? "読み込み中"
                : `装備 ${equipments.length} / アクセ ${accessories.length}`}
            </span>
          </div>

          <div className={styles.jobFilterBox}>
            <label className={styles.fieldLabel}>
              職業
              <select
                value={selectedGameJobId}
                disabled={isLoading}
                onChange={(e) => {
                  setSelectedGameJobId(e.target.value);
                  setSelectedItemIds({});
                  setItemSearchKeywords({});
                  setItemBonusWeights({});
                  setSetSearchKeyword("");
                  setIsSetSuggestionOpen(false);
                }}
              >
                {isLoading ? (
                  <option value="">読み込み中...</option>
                ) : (
                  <>
                    <option value="">すべての職業</option>

                    {gameJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>
          </div>

          <div className={styles.setSearchBox}>
            <label className={styles.fieldLabel}>
              防具セット検索
              <input
                type="search"
                value={setSearchKeyword}
                onFocus={() => setIsSetSuggestionOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => {
                    setIsSetSuggestionOpen(false);
                  }, 120);
                }}
                onChange={(e) => {
                  setSetSearchKeyword(e.target.value);
                  setIsSetSuggestionOpen(true);
                }}
                placeholder="例: まこうしゃく / 魔侯爵 / ろーどりー"
              />

              {activeSetBonuses.length > 0 && (
                <div className={styles.setBonusBox}>
                  <h3>セット効果</h3>

                  <div className={styles.setBonusList}>
                    {activeSetBonuses.map((bonus) => (
                      <div
                        key={bonus.groupKey}
                        className={`${styles.setBonusRow} ${
                          bonus.isActive ? styles.setBonusActive : ""
                        }`}
                      >
                        <span>{bonus.groupName}</span>

                        <small>
                          {bonus.selectedCount}/{bonus.requiredCount} 部位
                        </small>

                        <strong>おもさ+{bonus.weightBonus}</strong>

                        <em>{bonus.isActive ? "発動中" : "未発動"}</em>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </label>

            {isSetSuggestionOpen &&
              setSearchKeyword &&
              armorSetSuggestions.length > 0 && (
                <div className={styles.suggestionList}>
                  {armorSetSuggestions.map((group) => (
                    <button
                      key={group.setKey}
                      type="button"
                      className={styles.suggestionButton}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyArmorSet(group);
                      }}
                    >
                      <span>
                        <strong>{group.setName}</strong>
                        <small>
                          Lv {group.equipLevel || "-"} / {group.slotCount} 部位
                        </small>
                      </span>
                      <em>セットする</em>
                    </button>
                  ))}
                </div>
              )}
          </div>
           <p className={styles.text}>錬金、合成の重さはヘビチャ対象外</p>
          {isLoading ? (
            <div className={styles.loadingBox}>装備データを読み込み中...</div>
          ) : (
            <div className={styles.equipmentList}>
              {visibleItemSlots.map((slot) => {
                const slotItems = itemsBySlot[slot.key] || [];
                const selectedItem = allItems.find(
                  (item) => String(item.id) === String(selectedItemIds[slot.key])
                );

                return (
                  <SearchableItemPicker
                    key={slot.key}
                    slotKey={slot.key}
                    label={slot.label}
                    items={slotItems}
                    selectedItem={selectedItem}
                    searchKeyword={itemSearchKeywords[slot.key] || ""}
                    bonusLabel={slot.bonusLabel}
                    bonusValue={itemBonusWeights[slot.key] || ""}
                    onBonusChange={(value) => {
                      setItemBonusWeights((prev) => ({
                        ...prev,
                        [slot.key]: value,
                      }));
                    }}
                    onSearchChange={(value) => {
                      setItemSearchKeywords((prev) => ({
                        ...prev,
                        [slot.key]: value,
                      }));
                    }}
                    onSelect={(item) => {
                      handleSelectItem(slot.key, item.id);

                      setItemSearchKeywords((prev) => ({
                        ...prev,
                        [slot.key]: item.name,
                      }));
                    }}
                    onClear={() => {
                      handleSelectItem(slot.key, "");

                      setItemSearchKeywords((prev) => ({
                        ...prev,
                        [slot.key]: "",
                      }));

                      setItemBonusWeights((prev) => ({
                        ...prev,
                        [slot.key]: "",
                      }));
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      <BossJudgeSection
        bosses={bosses}
        finalWeight={finalWeight}
        useWeightBreak={useWeightBreak}
        isLoading={isLoading}
      />
    </main>
  );
}