<?php

namespace App\Services;

use App\Models\MonsterDrop;

class MonsterDropSyncService
{
    public function sync(string $targetType, int $targetId, array $rows): void
    {
        MonsterDrop::query()
            ->where('drop_target_type', $targetType)
            ->where('drop_target_id', $targetId)
            ->delete();

        foreach (array_values($rows) as $index => $row) {
            $monsterId = (int) ($row['monster_id'] ?? 0);

            if (!$monsterId) {
                continue;
            }

            MonsterDrop::create([
                'monster_id' => $monsterId,
                'drop_target_type' => $targetType,
                'drop_target_id' => $targetId,
                'drop_type' => $row['drop_type'] ?? 'normal',
                'sort_order' => $row['sort_order'] ?? ($index + 1),
            ]);
        }
    }
}