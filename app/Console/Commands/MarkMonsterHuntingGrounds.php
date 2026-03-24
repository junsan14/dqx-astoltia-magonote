<?php

namespace App\Console\Commands;

use App\Models\Map;
use App\Models\MapLayer;
use App\Models\Monster;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MarkMonsterHuntingGrounds extends Command
{
    protected $signature = 'monster-map-spawns:mark-hunting-grounds
                            {csv : CSV file path}
                            {--dry-run : Do not update DB, only show result}';

    protected $description = 'CSVの monster_name / map_name を元に monster_map_spawns の is_hunting_ground を true にする';

    public function handle(): int
    {
        $csvPath = (string) $this->argument('csv');
        $dryRun = (bool) $this->option('dry-run');

        if (!is_file($csvPath)) {
            $this->error("CSVファイルが見つからない: {$csvPath}");
            return self::FAILURE;
        }

        [$headers, $rows] = $this->readCsv($csvPath);

        if (!in_array('monster_name', $headers, true) || !in_array('map_name', $headers, true)) {
            $this->error('CSVに monster_name または map_name カラムがない');
            $this->line('検出ヘッダー: ' . implode(', ', $headers));
            return self::FAILURE;
        }

        $pairs = [];
        foreach ($rows as $row) {
            $monsterName = trim((string) ($row['monster_name'] ?? ''));
            $mapName = trim((string) ($row['map_name'] ?? ''));

            if ($monsterName === '' || $mapName === '') {
                continue;
            }

            $key = $monsterName . '||' . $mapName;
            $pairs[$key] = [
                'monster_name' => $monsterName,
                'map_name' => $mapName,
            ];
        }

        if (empty($pairs)) {
            $this->warn('処理対象の monster_name / map_name が見つからない');
            return self::SUCCESS;
        }

        $this->info('対象ペア数: ' . count($pairs));
        if ($dryRun) {
            $this->warn('DRY RUN: DB更新はしない');
        }

        $updatedRows = 0;
        $processedPairs = 0;
        $notFoundMonsters = [];
        $notFoundMaps = [];
        $noSpawnMatches = [];

        DB::beginTransaction();

        try {
            foreach ($pairs as $pair) {
                $monsterName = $pair['monster_name'];
                $mapName = $pair['map_name'];

                $monster = Monster::query()
                    ->select(['id', 'name'])
                    ->where('name', $monsterName)
                    ->first();

                if (!$monster) {
                    $notFoundMonsters[] = $monsterName;
                    $this->warn("モンスター未検出: {$monsterName}");
                    continue;
                }

                $map = Map::query()
                    ->select(['id', 'name'])
                    ->where('name', $mapName)
                    ->first();

                if (!$map) {
                    $notFoundMaps[] = $mapName;
                    $this->warn("マップ未検出: {$mapName}");
                    continue;
                }

                $layerIds = MapLayer::query()
                    ->where('map_id', $map->id)
                    ->orderBy('display_order')
                    ->pluck('id')
                    ->values()
                    ->all();

                $query = DB::table('monster_map_spawns')
                    ->where('monster_id', $monster->id)
                    ->where('map_id', $map->id);

                if (count($layerIds) === 1) {
                    $query->where('map_layer_id', $layerIds[0]);
                } elseif (count($layerIds) > 1) {
                    $query->whereIn('map_layer_id', $layerIds);
                } else {
                    // map_layers が無いケースの保険
                    $query->whereNull('map_layer_id');
                }

                $matchedCount = (clone $query)->count();

                if ($matchedCount === 0) {
                    $noSpawnMatches[] = "{$monsterName} / {$mapName}";
                    $this->warn("spawn未検出: {$monsterName} / {$mapName}");
                    continue;
                }

                $this->line(sprintf(
                    '[%s] monster_id=%d map_id=%d layer_count=%d spawn_match=%d',
                    "{$monsterName} / {$mapName}",
                    $monster->id,
                    $map->id,
                    count($layerIds),
                    $matchedCount
                ));

                if (!$dryRun) {
                    $affected = $query->update([
                        'is_hunting_ground' => 1,
                        'updated_at' => now(),
                    ]);

                    $updatedRows += $affected;
                } else {
                    $updatedRows += $matchedCount;
                }

                $processedPairs++;
            }

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error($e->getMessage());
            return self::FAILURE;
        }

        $this->newLine();
        $this->info('完了');
        $this->line('処理成功ペア数: ' . $processedPairs);
        $this->line('更新対象spawn数: ' . $updatedRows);
        $this->line('未検出モンスター数: ' . count(array_unique($notFoundMonsters)));
        $this->line('未検出マップ数: ' . count(array_unique($notFoundMaps)));
        $this->line('spawn未検出数: ' . count(array_unique($noSpawnMatches)));

        if (!empty($notFoundMonsters)) {
            $this->newLine();
            $this->warn('未検出モンスター一覧');
            foreach (array_unique($notFoundMonsters) as $name) {
                $this->line('- ' . $name);
            }
        }

        if (!empty($notFoundMaps)) {
            $this->newLine();
            $this->warn('未検出マップ一覧');
            foreach (array_unique($notFoundMaps) as $name) {
                $this->line('- ' . $name);
            }
        }

        if (!empty($noSpawnMatches)) {
            $this->newLine();
            $this->warn('spawn未検出一覧');
            foreach (array_unique($noSpawnMatches) as $label) {
                $this->line('- ' . $label);
            }
        }

        return self::SUCCESS;
    }

    /**
     * @return array{0: array<int, string>, 1: array<int, array<string, string|null>>}
     */
    private function readCsv(string $csvPath): array
    {
        $handle = fopen($csvPath, 'r');

        if ($handle === false) {
            throw new \RuntimeException("CSVを開けない: {$csvPath}");
        }

        $headers = [];
        $rows = [];
        $rowIndex = 0;

        while (($data = fgetcsv($handle)) !== false) {
            if ($rowIndex === 0) {
                $headers = array_map(function ($value) {
                    $value = (string) $value;
                    $value = preg_replace('/^\xEF\xBB\xBF/', '', $value); // BOM除去
                    return trim($value);
                }, $data);

                $rowIndex++;
                continue;
            }

            if ($this->isEmptyRow($data)) {
                $rowIndex++;
                continue;
            }

            $assoc = [];
            foreach ($headers as $index => $header) {
                $assoc[$header] = array_key_exists($index, $data)
                    ? trim((string) $data[$index])
                    : null;
            }

            $rows[] = $assoc;
            $rowIndex++;
        }

        fclose($handle);

        return [$headers, $rows];
    }

    /**
     * @param array<int, mixed> $row
     */
    private function isEmptyRow(array $row): bool
    {
        foreach ($row as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }
}