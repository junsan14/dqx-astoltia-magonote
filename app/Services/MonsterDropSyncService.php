<?php

namespace App\Services;

use App\Models\MonsterDrop;

class MonsterDropSyncService
{
    public function sync(string $targetType, int $targetId, array $dropMonsters): void
    {
        $existingDrops = MonsterDrop::query()
            ->where('drop_target_type', $targetType)
            ->where('drop_target_id', $targetId)
            ->get()
            ->keyBy('id');

        $keptIds = [];

        foreach (array_values($dropMonsters) as $index => $row) {
            $dropId = isset($row['id']) && $row['id'] !== '' ? (int) $row['id'] : null;
            $monsterId = (int) ($row['monster_id'] ?? 0);

            if ($monsterId <= 0) {
                continue;
            }

            $dropType = $row['drop_type'] ?? 'normal';
            $sortOrder = isset($row['sort_order']) && $row['sort_order'] !== ''
                ? (int) $row['sort_order']
                : ($index + 1);

            $payload = [
                'monster_id' => $monsterId,
                'drop_type' => $dropType,
                'sort_order' => $sortOrder,
            ];

            // 1. id一致で更新
            if ($dropId && $existingDrops->has($dropId)) {
                $drop = $existingDrops->get($dropId);
                $drop->update($payload);
                $keptIds[] = $drop->id;
                continue;
            }

            // 2. uniqueキー一致で更新
            $matched = MonsterDrop::query()
                ->where('drop_target_type', $targetType)
                ->where('drop_target_id', $targetId)
                ->where('monster_id', $monsterId)
                ->where('drop_type', $dropType)
                ->first();

            if ($matched) {
                $matched->update([
                    'sort_order' => $sortOrder,
                ]);
                $keptIds[] = $matched->id;
                continue;
            }

            // 3. なければ新規作成
            $newDrop = MonsterDrop::create([
                'drop_target_type' => $targetType,
                'drop_target_id' => $targetId,
                'monster_id' => $monsterId,
                'drop_type' => $dropType,
                'sort_order' => $sortOrder,
            ]);

            $keptIds[] = $newDrop->id;
        }

        MonsterDrop::query()
            ->where('drop_target_type', $targetType)
            ->where('drop_target_id', $targetId)
            ->when(
                !empty($keptIds),
                fn ($query) => $query->whereNotIn('id', $keptIds)
            )
            ->delete();
    }
}