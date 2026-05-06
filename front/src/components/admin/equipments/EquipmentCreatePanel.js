"use client";

import { useMemo } from "react";
import LabeledField from "./LabeledField";
import {
  buildEmptyGroupMembers,
  findEquipmentTypeById,
  getAutoSlotGridType,
  inferSingleSlotFromEquipmentType,
  str,
} from "./equipmentFormHelpers";

const GROUP_KIND_OPTIONS_FOR_CREATE = [
  { value: "tailoring_set", label: "ローブ(裁縫系)" },
  { value: "armor_set", label: "鎧(防具鍛冶系)" },
  { value: "craft_tool_set", label: "職人道具" },
];

const FALLBACK_NEW_ITEM = {
  itemId: "",
  itemName: "",
  equipmentTypeId: "",
  jobOverrideMode: "inherit",
  slot: "",
  slotGridType: "",
  groupName: "",
  equipLevel: "",
};

const FALLBACK_NEW_GROUP = {
  groupName: "",
  groupKind: "armor_set",
  equipmentTypeId: "",
  jobOverrideMode: "inherit",
  members: buildEmptyGroupMembers("armor_set"),
  equipLevel: "",
};

export default function EquipmentCreatePanel({
  newMode,
  setNewMode,
  newItem,
  setNewItem,
  newGroup,
  setNewGroup,
  equipmentTypes = [],
  existingEquipments = [],
}) {
  const safeNewItem = newItem ?? FALLBACK_NEW_ITEM;
  const safeNewGroup = newGroup ?? FALLBACK_NEW_GROUP;
  const safeMembers = Array.isArray(safeNewGroup.members)
    ? safeNewGroup.members
    : [];

  const isCraftToolSet = safeNewGroup.groupKind === "craft_tool_set";

  const usedItemIdSet = useMemo(() => {
    return new Set(
      (Array.isArray(existingEquipments) ? existingEquipments : [])
        .map((row) => str(row.itemId ?? row.item_id).trim())
        .filter(Boolean)
    );
  }, [existingEquipments]);

  const selectedSingleType = useMemo(() => {
    return findEquipmentTypeById(equipmentTypes, safeNewItem.equipmentTypeId);
  }, [equipmentTypes, safeNewItem.equipmentTypeId]);

  const selectedGroupType = useMemo(() => {
    return findEquipmentTypeById(equipmentTypes, safeNewGroup.equipmentTypeId);
  }, [equipmentTypes, safeNewGroup.equipmentTypeId]);

  const singleItemIdBase = useMemo(() => {
    if (isNormalArmorType(selectedSingleType)) {
      return makeBouguGroupBase(safeNewItem.equipLevel);
    }

    return makeItemIdBase(selectedSingleType, safeNewItem.equipLevel);
  }, [selectedSingleType, safeNewItem.equipLevel]);

  const singleItemIdCandidates = useMemo(() => {
    if (!singleItemIdBase) return [];

    if (isNormalArmorType(selectedSingleType)) {
      const slotKey = normalizeSlotKey(safeNewItem.slot);

      return buildSingleBouguCandidates({
        base: singleItemIdBase,
        slotKey,
        usedSet: usedItemIdSet,
      });
    }

    return buildItemIdCandidates(singleItemIdBase, usedItemIdSet);
  }, [
    singleItemIdBase,
    selectedSingleType,
    safeNewItem.slot,
    usedItemIdSet,
  ]);

  const groupItemIdBase = useMemo(() => {
    if (isCraftToolSet) return "";

    if (isNormalArmorType(selectedGroupType)) {
      return makeBouguGroupBase(safeNewGroup.equipLevel);
    }

    return makeItemIdBase(selectedGroupType, safeNewGroup.equipLevel);
  }, [selectedGroupType, safeNewGroup.equipLevel, isCraftToolSet]);

  const groupItemIdCandidates = useMemo(() => {
    if (isCraftToolSet || !groupItemIdBase) return [];

    if (isNormalArmorType(selectedGroupType)) {
      return buildBouguGroupCandidates({
        base: groupItemIdBase,
        members: safeMembers,
        usedSet: usedItemIdSet,
      });
    }

    return buildItemIdCandidates(groupItemIdBase, usedItemIdSet, 12);
  }, [
    groupItemIdBase,
    isCraftToolSet,
    selectedGroupType,
    safeMembers,
    usedItemIdSet,
  ]);

  const groupMemberItemIdSuggestions = useMemo(() => {
    return buildGroupMemberItemIdSuggestions({
      base: groupItemIdBase,
      members: safeMembers,
      selectedType: selectedGroupType,
      usedSet: usedItemIdSet,
      isCraftToolSet,
    });
  }, [
    groupItemIdBase,
    safeMembers,
    selectedGroupType,
    usedItemIdSet,
    isCraftToolSet,
  ]);

  const firstUnusedSingleCandidate = useMemo(() => {
    return (
      singleItemIdCandidates.find((candidate) => !candidate.used)?.value ?? ""
    );
  }, [singleItemIdCandidates]);

  function updateSingleEquipmentType(nextEquipmentTypeId) {
    const nextType = findEquipmentTypeById(equipmentTypes, nextEquipmentTypeId);
    const inferred = inferSingleSlotFromEquipmentType(nextType);

    setNewItem((prev) => {
      const base = prev ?? FALLBACK_NEW_ITEM;

      return {
        ...base,
        equipmentTypeId: nextEquipmentTypeId,
        slot: inferred.slot || "",
        slotGridType: inferred.slotGridType || "",
        itemId: "",
      };
    });
  }

  function updateSingleEquipLevel(nextEquipLevel) {
    setNewItem((prev) => ({
      ...(prev ?? FALLBACK_NEW_ITEM),
      equipLevel: nextEquipLevel,
      itemId: "",
    }));
  }

  function updateGroupEquipmentType(nextEquipmentTypeId) {
    const nextType = findEquipmentTypeById(equipmentTypes, nextEquipmentTypeId);

    setNewGroup((prev) => {
      const base = prev ?? FALLBACK_NEW_GROUP;
      const members = Array.isArray(base.members) ? base.members : [];

      return {
        ...base,
        equipmentTypeId: nextEquipmentTypeId,
        members: members.map((member) => ({
          ...member,
          itemId: "",
          slotGridType: getAutoSlotGridType(
            member.slot,
            nextType,
            base.groupKind,
            member
          ),
        })),
      };
    });
  }

  function updateGroupKind(nextKind) {
    const selectedType = findEquipmentTypeById(
      equipmentTypes,
      safeNewGroup.equipmentTypeId
    );

    setNewGroup((prev) => ({
      ...(prev ?? FALLBACK_NEW_GROUP),
      groupKind: nextKind,
      equipmentTypeId:
        nextKind === "craft_tool_set" ? "" : prev?.equipmentTypeId ?? "",
      equipLevel: nextKind === "craft_tool_set" ? "" : prev?.equipLevel ?? "",
      members: buildEmptyGroupMembers(nextKind).map((member) => ({
        ...member,
        itemId: "",
        slotGridType: getAutoSlotGridType(
          member.slot,
          selectedType,
          nextKind,
          member
        ),
      })),
    }));
  }

  function setSingleItemId(value) {
    setNewItem((prev) => ({
      ...(prev ?? FALLBACK_NEW_ITEM),
      itemId: value,
    }));
  }

  function applyFirstUnusedCandidate() {
    if (!firstUnusedSingleCandidate) return;
    setSingleItemId(firstUnusedSingleCandidate);
  }

  function updateGroupMember(index, patch) {
    setNewGroup((prev) => {
      const base = prev ?? FALLBACK_NEW_GROUP;
      const members = Array.isArray(base.members) ? [...base.members] : [];

      members[index] = {
        ...members[index],
        ...patch,
      };

      return {
        ...base,
        members,
      };
    });
  }

  return (
    <section style={styles.card}>
      <div style={styles.sectionHead}>
        <div>
          <div style={styles.sectionTitle}>新規追加</div>
          <p style={styles.sectionLead}>
            item_id は現在のルールに合わせて候補を作成
          </p>
        </div>
      </div>

      <div style={styles.segment}>
        <button
          type="button"
          onClick={() => setNewMode("single")}
          style={segmentButtonStyle(newMode === "single")}
        >
          単体
        </button>
        <button
          type="button"
          onClick={() => setNewMode("group")}
          style={segmentButtonStyle(newMode === "group")}
        >
          セット
        </button>
      </div>

      {newMode === "single" ? (
        <>
          <div style={styles.grid2}>
            <LabeledField label="装備名">
              <input
                style={styles.input}
                value={safeNewItem.itemName}
                onChange={(e) =>
                  setNewItem((prev) => ({
                    ...(prev ?? FALLBACK_NEW_ITEM),
                    itemName: e.target.value,
                  }))
                }
                placeholder="例: セーラスソード"
              />
            </LabeledField>

            <LabeledField label="装備レベル">
              <input
                type="number"
                style={styles.input}
                value={safeNewItem.equipLevel ?? ""}
                onChange={(e) => updateSingleEquipLevel(e.target.value)}
                placeholder="例: 135"
                min="1"
              />
            </LabeledField>

            <LabeledField label="装備タイプ">
              <select
                style={styles.select}
                value={safeNewItem.equipmentTypeId}
                onChange={(e) => updateSingleEquipmentType(e.target.value)}
              >
                <option value="">未選択</option>
                {equipmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name ?? type.label ?? `#${type.id}`}
                  </option>
                ))}
              </select>
            </LabeledField>

            <LabeledField label="item_id">
              <div style={styles.itemIdInputRow}>
                <input
                  style={styles.input}
                  value={safeNewItem.itemId ?? ""}
                  placeholder="候補から選択、または手入力"
                  onChange={(e) => setSingleItemId(e.target.value)}
                />

                <button
                  type="button"
                  style={smallButtonStyle(!firstUnusedSingleCandidate)}
                  disabled={!firstUnusedSingleCandidate}
                  onClick={applyFirstUnusedCandidate}
                >
                  候補を入れる
                </button>
              </div>
            </LabeledField>
          </div>

          <CandidateBox
            base={singleItemIdBase}
            candidates={singleItemIdCandidates}
            onSelect={setSingleItemId}
            note={
              isNormalArmorType(selectedSingleType)
                ? "防具を単体作成する場合も、bougu_レベル_セット番号_部位 の候補を使用"
                : "武器・盾は 装備タイプkey_レベル の候補を使用"
            }
          />
        </>
      ) : (
        <>
          <div style={styles.grid2}>
            <LabeledField label="セット名">
              <input
                style={styles.input}
                value={safeNewGroup.groupName}
                onChange={(e) =>
                  setNewGroup((prev) => ({
                    ...(prev ?? FALLBACK_NEW_GROUP),
                    groupName: e.target.value,
                  }))
                }
                placeholder={
                  isCraftToolSet ? "例: 職人道具セット" : "例: 皮セット"
                }
              />
            </LabeledField>

            <LabeledField label="セット種類">
              <select
                style={styles.select}
                value={safeNewGroup.groupKind}
                onChange={(e) => updateGroupKind(e.target.value)}
              >
                {GROUP_KIND_OPTIONS_FOR_CREATE.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </LabeledField>

            {!isCraftToolSet ? (
              <>
                <LabeledField label="装備レベル">
                  <input
                    type="number"
                    style={styles.input}
                    value={safeNewGroup.equipLevel ?? ""}
                    onChange={(e) =>
                      setNewGroup((prev) => ({
                        ...(prev ?? FALLBACK_NEW_GROUP),
                        equipLevel: e.target.value,
                      }))
                    }
                    placeholder="例: 135"
                    min="1"
                  />
                </LabeledField>

                <LabeledField label="装備タイプ">
                  <select
                    style={styles.select}
                    value={safeNewGroup.equipmentTypeId}
                    onChange={(e) => updateGroupEquipmentType(e.target.value)}
                  >
                    <option value="">未選択</option>
                    {equipmentTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name ?? type.label ?? `#${type.id}`}
                      </option>
                    ))}
                  </select>
                </LabeledField>
              </>
            ) : null}
          </div>

          {!isCraftToolSet ? (
            <CandidateBox
              base={groupItemIdBase}
              candidates={groupItemIdCandidates}
              onSelect={null}
              note={
                isNormalArmorType(selectedGroupType)
                  ? "防具セット作成時は、下の各部位の item_id を編集できる"
                  : "武器・盾系のセット作成時も、下の各部位の item_id を編集できる"
              }
            />
          ) : null}

          <div style={styles.membersWrap}>
            {safeMembers.map((member, index) => {
              const memberKey = getMemberStableKey(member, index);
              const suggestedItemId =
                groupMemberItemIdSuggestions.get(memberKey) ?? "";

              return (
                <div key={member.key ?? index} style={styles.memberCard}>
                  <label style={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={!!member.enabled}
                      onChange={(e) =>
                        updateGroupMember(index, {
                          enabled: e.target.checked,
                        })
                      }
                    />
                    <span>{member.slotLabel}</span>
                  </label>

                  <input
                    style={styles.input}
                    value={member.itemName ?? ""}
                    placeholder="名前を個別指定"
                    onChange={(e) =>
                      updateGroupMember(index, {
                        itemName: e.target.value,
                      })
                    }
                  />

                  <div style={styles.memberItemIdArea}>
                    <div style={styles.memberItemIdLabel}>item_id</div>

                    <div style={styles.itemIdInputRow}>
                      <input
                        style={styles.input}
                        value={member.itemId ?? ""}
                        placeholder={
                          suggestedItemId || "装備タイプとレベルから候補を作成"
                        }
                        onChange={(e) =>
                          updateGroupMember(index, {
                            itemId: e.target.value,
                          })
                        }
                      />

                      <button
                        type="button"
                        style={smallButtonStyle(!suggestedItemId)}
                        disabled={!suggestedItemId}
                        onClick={() =>
                          updateGroupMember(index, {
                            itemId: suggestedItemId,
                          })
                        }
                      >
                        候補
                      </button>
                    </div>

                    <div style={styles.memberItemIdHelp}>
                      {suggestedItemId
                        ? `候補: ${suggestedItemId}`
                        : "候補なし"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function CandidateBox({ base, candidates, onSelect, note }) {
  return (
    <div style={styles.candidateBox}>
      <div style={styles.candidateTitle}>item_id 候補</div>

      <div style={styles.candidateHelp}>
        {base
          ? `基本形: ${base}`
          : "装備タイプと装備レベルを選択すると候補を表示"}
      </div>

      {note ? <div style={styles.candidateHelp}>{note}</div> : null}

      {candidates.length ? (
        <div style={styles.candidateList}>
          {candidates.map((candidate) => (
            <button
              key={candidate.value}
              type="button"
              disabled={candidate.used || !onSelect}
              style={candidateButtonStyle(candidate.used, !onSelect)}
              onClick={() => {
                if (!onSelect || candidate.used) return;
                onSelect(candidate.value);
              }}
            >
              <span>{candidate.value}</span>
              <small>{candidate.used ? "使用中" : "未使用"}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function makeItemIdBase(equipmentType, equipLevel) {
  const key = str(equipmentType?.key).trim();
  const level = str(equipLevel).trim();

  if (!key || !level) return "";

  return `${key}_${level}`;
}

function isNormalArmorType(equipmentType) {
  const kind = str(equipmentType?.kind).trim();
  const key = str(equipmentType?.key).trim();

  return kind === "armor" && key !== "shield_small" && key !== "shield_large";
}

function makeBouguGroupBase(equipLevel) {
  const level = str(equipLevel).trim();

  if (!level) return "";

  return `bougu_${level}`;
}

function normalizeSlotKey(slot) {
  const value = str(slot).trim();

  if (["head", "あたま", "頭"].includes(value)) return "head";
  if (["body_top", "からだ上", "身体上", "体上"].includes(value)) {
    return "body_top";
  }
  if (["body_bottom", "からだ下", "身体下", "体下", "体した"].includes(value)) {
    return "body_bottom";
  }
  if (["arm", "arms", "うで", "腕"].includes(value)) return "arm";
  if (["foot", "feet", "足", "あし"].includes(value)) return "foot";

  return value || "unknown";
}

function getMemberStableKey(member, index) {
  return str(member.key ?? member.slot ?? index);
}

function buildSingleBouguCandidates({ base, slotKey, usedSet }) {
  if (!base || !slotKey) return [];

  return Array.from({ length: 8 }, (_, index) => {
    const setNo = index + 1;
    const value = `${base}_${setNo}_${slotKey}`;

    return {
      value,
      used: usedSet.has(value),
      slotKey,
      setNo,
    };
  });
}

function buildBouguGroupCandidates({ base, members, usedSet }) {
  if (!base) return [];

  const enabledMembers = Array.isArray(members)
    ? members.filter((member) => member.enabled)
    : [];

  if (!enabledMembers.length) return [];

  const result = [];

  for (let setNo = 1; setNo <= 8; setNo++) {
    const candidateRows = enabledMembers.map((member) => {
      const slotKey = normalizeSlotKey(member.slot);
      const value = `${base}_${setNo}_${slotKey}`;

      return {
        value,
        used: usedSet.has(value),
        slotKey,
        setNo,
      };
    });

    const allUsed = candidateRows.every((candidate) => candidate.used);

    result.push(...candidateRows);

    if (!allUsed) {
      break;
    }
  }

  return result;
}

function buildGroupMemberItemIdSuggestions({
  base,
  members,
  selectedType,
  usedSet,
  isCraftToolSet,
}) {
  const map = new Map();

  if (isCraftToolSet || !base) {
    return map;
  }

  const safeMembers = Array.isArray(members) ? members : [];

  if (isNormalArmorType(selectedType)) {
    const setNo = findFirstAvailableBouguSetNo({
      base,
      members: safeMembers,
      usedSet,
    });

    safeMembers.forEach((member, index) => {
      const key = getMemberStableKey(member, index);
      const slotKey = normalizeSlotKey(member.slot);

      map.set(key, `${base}_${setNo}_${slotKey}`);
    });

    return map;
  }

  const localUsed = new Set(Array.from(usedSet));

  safeMembers.forEach((member, index) => {
    const key = getMemberStableKey(member, index);
    const candidate = makeUniqueItemId(base, localUsed);

    if (candidate) {
      localUsed.add(candidate);
    }

    map.set(key, candidate);
  });

  return map;
}

function findFirstAvailableBouguSetNo({ base, members, usedSet }) {
  const enabledMembers = Array.isArray(members)
    ? members.filter((member) => member.enabled)
    : [];

  const targetMembers = enabledMembers.length ? enabledMembers : members;

  for (let setNo = 1; setNo <= 99; setNo++) {
    const allUnused = targetMembers.every((member) => {
      const slotKey = normalizeSlotKey(member.slot);
      const value = `${base}_${setNo}_${slotKey}`;

      return !usedSet.has(value);
    });

    if (allUnused) {
      return setNo;
    }
  }

  return 1;
}

function buildItemIdCandidates(base, usedSet, count = 8) {
  if (!base) return [];

  return Array.from({ length: count }, (_, index) => {
    const value = index === 0 ? base : `${base}_${index + 1}`;

    return {
      value,
      used: usedSet.has(value),
    };
  });
}

function makeUniqueItemId(baseItemId, usedSet) {
  const base = str(baseItemId).trim();

  if (!base) return "";

  if (!usedSet.has(base)) {
    return base;
  }

  let count = 2;
  let candidate = `${base}_${count}`;

  while (usedSet.has(candidate)) {
    count++;
    candidate = `${base}_${count}`;
  }

  return candidate;
}

const styles = {
  card: {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: 14,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
  },

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-title)",
  },

  sectionLead: {
    margin: "4px 0 0",
    color: "var(--text-muted)",
    fontSize: 12,
    lineHeight: 1.5,
  },

  segment: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 10,
    padding: "10px 12px",
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 10,
    padding: "10px 12px",
  },

  itemIdInputRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    alignItems: "center",
  },

  candidateBox: {
    border: "1px solid var(--soft-border)",
    background: "var(--soft-bg)",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  candidateTitle: {
    color: "var(--text-main)",
    fontWeight: 900,
    fontSize: 13,
  },

  candidateHelp: {
    color: "var(--text-muted)",
    fontSize: 12,
    lineHeight: 1.5,
  },

  candidateList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  membersWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },

  memberCard: {
    border: "1px solid var(--soft-border)",
    background: "var(--soft-bg)",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "var(--text-main)",
    fontWeight: 700,
  },

  memberItemIdArea: {
    borderTop: "1px solid var(--soft-border)",
    paddingTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  memberItemIdLabel: {
    color: "var(--text-main)",
    fontSize: 12,
    fontWeight: 900,
  },

  memberItemIdHelp: {
    color: "var(--text-muted)",
    fontSize: 11,
    lineHeight: 1.4,
    wordBreak: "break-all",
  },
};

const segmentButtonStyle = (active) => ({
  border: `1px solid ${
    active ? "var(--selected-border)" : "var(--soft-border)"
  }`,
  background: active ? "var(--selected-bg)" : "var(--soft-bg)",
  color: "var(--text-main)",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
});

const candidateButtonStyle = (used, readonly) => ({
  border: `1px solid ${used ? "var(--soft-border)" : "var(--selected-border)"}`,
  background: used ? "var(--card-bg)" : "var(--selected-bg)",
  color: used ? "var(--text-muted)" : "var(--text-main)",
  borderRadius: 999,
  padding: "7px 10px",
  cursor: used || readonly ? "not-allowed" : "pointer",
  fontSize: 12,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  opacity: used ? 0.65 : 1,
});

const smallButtonStyle = (disabled = false) => ({
  border: "1px solid var(--soft-border)",
  background: disabled ? "var(--input-disabled-bg)" : "var(--soft-bg)",
  color: disabled ? "var(--text-muted)" : "var(--text-main)",
  borderRadius: 10,
  padding: "8px 12px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 800,
  whiteSpace: "nowrap",
});