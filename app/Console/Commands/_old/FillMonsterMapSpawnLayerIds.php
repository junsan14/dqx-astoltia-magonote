<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FillMonsterMapSpawnLayerIds extends Command
{
    protected $signature = 'dq10:fill-monster-map-spawn-layer-ids
                            {--map= : 特定マップ名だけ対象にする}
                            {--map-id= : 特定 map_id だけ対象にする}
                            {--monster= : 特定モンスター名だけ対象にする}
                            {--limit= : 更新件数の上限}
                            {--dry-run : 更新せずに対象だけ表示する}
                            {--delete-merged-source : マージ成功後、元の NULL layer 行を削除する（デフォルト有効）}';

    protected $description = 'monster_map_spawns の map_layer_id が NULL のものだけを、map_layers から解決して更新する。重複時は既存行へマージする';

    public function handle(): int
    {
        $this->warn('FillMonsterMapSpawnLayerIds running');

        $dryRun = (bool) $this->option('dry-run');
        $mapName = $this->option('map');
        $mapId = $this->option('map-id');
        $monsterName = $this->option('monster');
        $limit = $this->option('limit');
        $deleteMergedSource = true;

        $query = DB::table('monster_map_spawns as mms')
            ->join('maps as mp', 'mp.id', '=', 'mms.map_id')
            ->leftJoin('monsters as mo', 'mo.id', '=', 'mms.monster_id')
            ->whereNull('mms.map_layer_id')
            ->select([
                'mms.id as spawn_id',
                'mms.monster_id',
                'mms.map_id',
                'mms.spawn_time',
                'mms.area',
                'mms.note',
                'mms.created_at',
                'mms.updated_at',
                'mp.name as map_name',
                'mp.continent as continent',
                'mp.map_type as map_type',
                'mo.name as monster_name',
            ])
            ->orderBy('mms.map_id')
            ->orderBy('mms.id');

        if ($mapName) {
            $query->where('mp.name', $mapName);
        }

        if ($mapId) {
            $query->where('mms.map_id', (int) $mapId);
        }

        if ($monsterName) {
            $query->where('mo.name', $monsterName);
        }

        if ($limit !== null && $limit !== '') {
            $query->limit((int) $limit);
        }

        $targets = $query->get();

        if ($targets->isEmpty()) {
            $this->info('対象の spawn は 0 件');
            return self::SUCCESS;
        }

        $this->info('対象 spawn 件数: ' . $targets->count());

        $mapIds = $targets->pluck('map_id')->unique()->values()->all();

        $layerRows = DB::table('map_layers')
            ->whereIn('map_id', $mapIds)
            ->select([
                'id',
                'map_id',
                'layer_name',
                'floor_no',
                'display_order',
                'image_path',
                'source_url',
            ])
            ->orderBy('map_id')
            ->orderByRaw("
                CASE
                    WHEN layer_name = '地上' THEN 0
                    WHEN floor_no = 1 THEN 1
                    ELSE 2
                END
            ")
            ->orderBy('floor_no')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();

        $layersByMapId = [];
        foreach ($layerRows as $layer) {
            $layersByMapId[$layer->map_id][] = $layer;
        }

        $updated = 0;
        $merged = 0;
        $deleted = 0;
        $skippedNoLayer = 0;
        $skippedAlreadySet = 0;
        $skippedUnexpected = 0;

        foreach ($targets as $row) {
            $candidateLayers = $layersByMapId[$row->map_id] ?? [];

            if (empty($candidateLayers)) {
                $this->warn(sprintf(
                    '[SKIP:NO_LAYER] spawn_id=%d map_id=%d map=%s monster=%s',
                    $row->spawn_id,
                    $row->map_id,
                    $row->map_name ?? '',
                    $row->monster_name ?? ''
                ));
                $skippedNoLayer++;
                continue;
            }

            $resolvedLayer = $this->resolveLayerForSpawn($row, $candidateLayers);

            if (! $resolvedLayer) {
                $this->warn(sprintf(
                    '[SKIP:UNRESOLVED] spawn_id=%d map_id=%d map=%s monster=%s',
                    $row->spawn_id,
                    $row->map_id,
                    $row->map_name ?? '',
                    $row->monster_name ?? ''
                ));
                $skippedNoLayer++;
                continue;
            }

            $baseLog = sprintf(
                'spawn_id=%d monster=%s map=%s => layer_id=%d layer_name=%s floor_no=%s',
                $row->spawn_id,
                $row->monster_name ?? '(unknown)',
                $row->map_name ?? '(unknown)',
                $resolvedLayer->id,
                $resolvedLayer->layer_name ?? '',
                (string) ($resolvedLayer->floor_no ?? '')
            );

            if ($dryRun) {
                $duplicate = DB::table('monster_map_spawns')
                    ->where('monster_id', $row->monster_id)
                    ->where('map_id', $row->map_id)
                    ->where('map_layer_id', $resolvedLayer->id)
                    ->where('spawn_time', $row->spawn_time)
                    ->where('id', '<>', $row->spawn_id)
                    ->first();

                if ($duplicate) {
                    $this->line('[DRY-RUN:MERGE] ' . $baseLog . ' duplicate_id=' . $duplicate->id);
                } else {
                    $this->line('[DRY-RUN:UPDATE] ' . $baseLog);
                }

                continue;
            }

            try {
                DB::beginTransaction();

                $current = DB::table('monster_map_spawns')
                    ->lockForUpdate()
                    ->where('id', $row->spawn_id)
                    ->first();

                if (! $current) {
                    DB::rollBack();
                    $this->warn('[SKIP:NOT_FOUND] ' . $baseLog);
                    $skippedUnexpected++;
                    continue;
                }

                if ($current->map_layer_id !== null) {
                    DB::rollBack();
                    $this->warn('[SKIP:ALREADY_SET] ' . $baseLog);
                    $skippedAlreadySet++;
                    continue;
                }

                $duplicate = DB::table('monster_map_spawns')
                    ->lockForUpdate()
                    ->where('monster_id', $current->monster_id)
                    ->where('map_id', $current->map_id)
                    ->where('map_layer_id', $resolvedLayer->id)
                    ->where('spawn_time', $current->spawn_time)
                    ->where('id', '<>', $current->id)
                    ->first();

                if ($duplicate) {
                    $this->mergeIntoDuplicateAndDeleteSource(
                        source: $current,
                        duplicate: $duplicate,
                        deleteMergedSource: $deleteMergedSource
                    );

                    DB::commit();

                    $this->info('[MERGED] ' . $baseLog . ' duplicate_id=' . $duplicate->id);
                    $merged++;

                    if ($deleteMergedSource) {
                        $deleted++;
                    }

                    continue;
                }

                $affected = DB::table('monster_map_spawns')
                    ->where('id', $current->id)
                    ->whereNull('map_layer_id')
                    ->update([
                        'map_layer_id' => $resolvedLayer->id,
                        'updated_at' => now(),
                    ]);

                DB::commit();

                if ($affected > 0) {
                    $this->info('[UPDATED] ' . $baseLog);
                    $updated++;
                } else {
                    $this->warn('[SKIP:ALREADY_SET] ' . $baseLog);
                    $skippedAlreadySet++;
                }
            } catch (\Throwable $e) {
                DB::rollBack();
                $this->error('[ERROR] ' . $baseLog . ' message=' . $e->getMessage());
                $skippedUnexpected++;
            }
        }

        $this->newLine();
        $this->info(sprintf(
            '完了 updated=%d merged=%d deleted=%d skipped_no_layer=%d skipped_already_set=%d skipped_unexpected=%d',
            $updated,
            $merged,
            $deleted,
            $skippedNoLayer,
            $skippedAlreadySet,
            $skippedUnexpected
        ));

        return self::SUCCESS;
    }

    /**
     * 1件の spawn に対して、最も妥当な map_layer を選ぶ
     *
     * 優先順位:
     * 1. layer_name = 地上
     * 2. floor_no = 1
     * 3. floor_no が最小
     * 4. display_order が最小
     * 5. id が最小
     */
    private function resolveLayerForSpawn(object $spawn, array $candidateLayers): ?object
    {
        if (empty($candidateLayers)) {
            return null;
        }

        foreach ($candidateLayers as $layer) {
            if (($layer->layer_name ?? null) === '地上') {
                return $layer;
            }
        }

        foreach ($candidateLayers as $layer) {
            if ((int) ($layer->floor_no ?? 0) === 1) {
                return $layer;
            }
        }

        usort($candidateLayers, function ($a, $b) {
            $aFloor = (int) ($a->floor_no ?? 999999);
            $bFloor = (int) ($b->floor_no ?? 999999);

            if ($aFloor !== $bFloor) {
                return $aFloor <=> $bFloor;
            }

            $aOrder = (int) ($a->display_order ?? 999999);
            $bOrder = (int) ($b->display_order ?? 999999);

            if ($aOrder !== $bOrder) {
                return $aOrder <=> $bOrder;
            }

            return (int) ($a->id ?? 999999) <=> (int) ($b->id ?? 999999);
        });

        return $candidateLayers[0] ?? null;
    }

    /**
     * duplicate 側に source の area/note をマージし、source を削除する
     */
    private function mergeIntoDuplicateAndDeleteSource(object $source, object $duplicate, bool $deleteMergedSource = true): void
    {
        $sourceAreas = $this->decodeJsonArray($source->area ?? null);
        $duplicateAreas = $this->decodeJsonArray($duplicate->area ?? null);
        $mergedAreas = $this->mergeStringArrays($duplicateAreas, $sourceAreas);

        $sourceNotes = $this->decodeJsonArray($source->note ?? null);
        $duplicateNotes = $this->decodeJsonArray($duplicate->note ?? null);
        $mergedNotes = $this->mergeStringArrays($duplicateNotes, $sourceNotes);

        $updateData = [
            'updated_at' => now(),
        ];

        if (! empty($mergedAreas)) {
            $updateData['area'] = json_encode($mergedAreas, JSON_UNESCAPED_UNICODE);
        } elseif ($duplicate->area === null && ! empty($sourceAreas)) {
            $updateData['area'] = json_encode($sourceAreas, JSON_UNESCAPED_UNICODE);
        }

        if (! empty($mergedNotes)) {
            $updateData['note'] = json_encode($mergedNotes, JSON_UNESCAPED_UNICODE);
        } elseif ($duplicate->note === null && ! empty($sourceNotes)) {
            $updateData['note'] = json_encode($sourceNotes, JSON_UNESCAPED_UNICODE);
        }

        DB::table('monster_map_spawns')
            ->where('id', $duplicate->id)
            ->update($updateData);

        if ($deleteMergedSource) {
            DB::table('monster_map_spawns')
                ->where('id', $source->id)
                ->delete();
        }
    }

    /**
     * JSON配列 or 生文字列を配列へ寄せる
     */
    private function decodeJsonArray($value): array
    {
        if ($value === null) {
            return [];
        }

        if (is_array($value)) {
            return array_values(array_filter(array_map(fn ($v) => trim((string) $v), $value), fn ($v) => $v !== ''));
        }

        $value = trim((string) $value);

        if ($value === '' || $value === 'null') {
            return [];
        }

        $decoded = json_decode($value, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return array_values(array_filter(array_map(fn ($v) => trim((string) $v), $decoded), fn ($v) => $v !== ''));
        }

        return [$value];
    }

    private function mergeStringArrays(array $base, array $extra): array
    {
        $merged = array_merge($base, $extra);
        $merged = array_map(fn ($v) => trim((string) $v), $merged);
        $merged = array_filter($merged, fn ($v) => $v !== '');
        $merged = array_values(array_unique($merged));
        sort($merged);

        return $merged;
    }
}