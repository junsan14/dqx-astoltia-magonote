<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AnnouncementDropChangeService
{
    public function record(Collection $before, Collection $after): void
    {
        $normalize = fn ($rows) => $rows->groupBy(fn ($row) => $row->drop_target_type.':'.$row->drop_target_id)
            ->map(fn ($group) => $group->map(fn ($row) => implode(':', [
                (int) $row->monster_id, $row->drop_type, (int) $row->sort_order,
            ]))->sort()->values()->all());
        $old = $normalize($before);
        $new = $normalize($after);
        foreach ($old->keys()->merge($new->keys())->unique() as $key) {
            if ($old->get($key, []) === $new->get($key, [])) continue;
            [$type, $id] = explode(':', $key, 2);
            DB::table('announcement_drop_changes')->upsert([
                'target_type' => $type, 'target_id' => (int) $id,
                'created_at' => now(), 'updated_at' => now(),
            ], ['target_type', 'target_id'], ['updated_at']);
        }
    }
}
