<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MonsterHabitatSyncService
{
    // Keep separate rows for the existing habitat APIs, but treat the parent as authoritative.
    public function sync(int $monsterId): void
    {
        DB::transaction(function () use ($monsterId) {
            $rootId = $monsterId;
            $seen = [];
            while ($rootId) {
                if (isset($seen[$rootId])) {
                    throw ValidationException::withMessages([
                        'reincarnation_parent_id' => '転生元の設定が循環しています。',
                    ]);
                }
                $seen[$rootId] = true;
                $parentId = DB::table('monsters')->where('id', $rootId)
                    ->value('reincarnation_parent_id');
                if (!$parentId) {
                    break;
                }
                $rootId = (int) $parentId;
            }
            $this->syncChildren($rootId);
        });
    }

    private function syncChildren(int $parentId): void
    {
        $spawns = DB::table('monster_map_spawns')->where('monster_id', $parentId)
            ->orderBy('id')->get();
        $children = DB::table('monsters')->where('reincarnation_parent_id', $parentId)->pluck('id');

        foreach ($children as $childId) {
            $keepIds = [];
            foreach ($spawns as $spawn) {
                // Time is part of the unique key: day/night entries must remain separate.
                $existing = DB::table('monster_map_spawns')
                    ->where('monster_id', $childId)
                    ->where('map_id', $spawn->map_id)
                    ->where('map_layer_id', $spawn->map_layer_id)
                    ->where('spawn_time', $spawn->spawn_time)
                    ->whereNotIn('id', $keepIds)
                    ->orderBy('id')->first();
                $payload = (array) $spawn;
                unset($payload['id'], $payload['created_at']);
                $payload['monster_id'] = $childId;
                $payload['updated_at'] = now();
                if ($existing) {
                    DB::table('monster_map_spawns')->where('id', $existing->id)->update($payload);
                    $keepIds[] = $existing->id;
                } else {
                    $keepIds[] = DB::table('monster_map_spawns')->insertGetId($payload + ['created_at' => now()]);
                }
            }
            DB::table('monster_map_spawns')->where('monster_id', $childId)
                ->whereNotIn('id', $keepIds)->delete();
            $this->syncChildren((int) $childId);
        }
    }
}
