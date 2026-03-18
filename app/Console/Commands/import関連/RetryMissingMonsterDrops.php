<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RetryMissingMonsterDrops extends Command
{
    protected $signature = 'dq10:retry-missing-monster-drops
                            {csv : CSV file path}
                            {--dry-run : Insertせず確認だけする}';

    protected $description = 'Retry missing monster drops from CSV';

    public function handle(): int
    {
        $csvPath = $this->argument('csv');
        $dryRun = (bool) $this->option('dry-run');

        if (!file_exists($csvPath)) {
            $this->error("CSV not found: {$csvPath}");
            return self::FAILURE;
        }

        $handle = fopen($csvPath, 'r');
        if (!$handle) {
            $this->error("Failed to open CSV: {$csvPath}");
            return self::FAILURE;
        }

        $header = fgetcsv($handle);
        if (!$header) {
            fclose($handle);
            $this->error('CSV header not found');
            return self::FAILURE;
        }

        $header = array_map([$this, 'normalizeHeader'], $header);

        $this->line('headers: ' . implode(', ', $header));

        $inserted = 0;
        $skipped = 0;
        $failed = 0;
        $rowNo = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNo++;

            try {
                if (count($row) < count($header)) {
                    $row = array_pad($row, count($header), null);
                } elseif (count($row) > count($header)) {
                    $row = array_slice($row, 0, count($header));
                }

                $data = array_combine($header, $row);

                $monsterName = trim((string) ($data['monster_name'] ?? ''));
                $sourceUrl   = trim((string) ($data['source_url'] ?? ''));
                $category    = trim((string) ($data['category'] ?? ''));
                $rawName     = trim((string) ($data['raw_name'] ?? ''));
                $note        = trim((string) ($data['note'] ?? ''));

                if ($monsterName === '' || $rawName === '' || $category === '') {
                    $this->warn("row {$rowNo}: required field missing | monster_name=[{$monsterName}] raw_name=[{$rawName}] category=[{$category}]");
                    $failed++;
                    continue;
                }

                if ($category === 'monster') {
                    $this->warn("row {$rowNo}: skip monster category: {$rawName}");
                    $skipped++;
                    continue;
                }

                $monster = DB::table('monsters')
                    ->where('name', $monsterName)
                    ->first();

                if (!$monster) {
                    $this->warn("row {$rowNo}: monster not found: {$monsterName}");
                    $failed++;
                    continue;
                }

                $resolved = $this->resolveTargetByCategory($category, $rawName);

                if (!$resolved) {
                    $this->warn("row {$rowNo}: target still not found: {$rawName}");
                    $failed++;
                    continue;
                }

                $dropType = $this->normalizeDropTypeFromCategory($category);
                $sortOrder = $this->resolveSortOrder($dropType);

                $exists = DB::table('monster_drops')
                    ->where('monster_id', $monster->id)
                    ->where('drop_target_type', $resolved['target_type'])
                    ->where('drop_target_id', $resolved['target_id'])
                    ->where('drop_type', $dropType)
                    ->exists();

                if ($exists) {
                    $this->line("skip exists: {$monsterName} / {$rawName}");
                    $skipped++;
                    continue;
                }

                $payload = [
                    'monster_id'       => $monster->id,
                    'drop_target_type' => $resolved['target_type'],
                    'drop_target_id'   => $resolved['target_id'],
                    'drop_type'        => $dropType,
                    'sort_order'       => $sortOrder,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ];

                if ($dryRun) {
                    $this->info("dry-run: {$monsterName} / {$rawName} => {$resolved['target_type']}:{$resolved['target_id']} / {$dropType}");
                    $inserted++;
                    continue;
                }

                DB::table('monster_drops')->insert($payload);
                $this->info("inserted: {$monsterName} / {$rawName}");
                $inserted++;
            } catch (\Throwable $e) {
                $this->warn("row {$rowNo}: {$e->getMessage()}");
                $failed++;
            }
        }

        fclose($handle);

        $this->newLine();
        $this->info('done');
        $this->line("inserted: {$inserted}");
        $this->line("skipped : {$skipped}");
        $this->line("failed  : {$failed}");

        return self::SUCCESS;
    }

    private function resolveTargetByCategory(string $category, string $rawName): ?array
    {
        return match ($category) {
            'normal_item', 'rare_item' => $this->findItemTarget($rawName),
            'equipment'                => $this->findEquipmentTarget($rawName),
            default                    => $this->findItemTarget($rawName) ?? $this->findEquipmentTarget($rawName),
        };
    }

    private function findItemTarget(string $name): ?array
    {
        foreach ($this->nameCandidates($name) as $candidate) {
            $item = DB::table('items')
                ->where('name', $candidate)
                ->first();

            if ($item) {
                return [
                    'target_type' => 'item',
                    'target_id' => $item->id,
                ];
            }
        }

        return null;
    }

    private function findEquipmentTarget(string $name): ?array
    {
        foreach ($this->nameCandidates($name) as $candidate) {
            $equipment = DB::table('equipments')
                ->where('item_name', $candidate)
                ->first();

            if ($equipment) {
                return [
                    'target_type' => 'equipment',
                    'target_id' => $equipment->id,
                ];
            }
        }

        return null;
    }

    private function normalizeDropTypeFromCategory(string $category): string
    {
        return match ($category) {
            'normal_item' => 'normal',
            'rare_item'   => 'rare',
            'equipment'   => 'equipment',
            default       => 'unknown',
        };
    }

    private function resolveSortOrder(string $dropType): int
    {
        return match ($dropType) {
            'normal'    => 1,
            'rare'      => 2,
            'equipment' => 3,
            default     => 99,
        };
    }

    private function normalizeHeader(string $value): string
    {
        $value = (string) $value;

        // BOM除去
        $value = preg_replace('/^\xEF\xBB\xBF/', '', $value);

        $value = trim($value);
        $value = str_replace([' ', '　'], '_', $value);

        return mb_strtolower($value);
    }

    private function nameCandidates(string $name): array
    {
        $name = trim($name);

        $candidates = [
            $name,
            str_replace('　', '', $name),
            preg_replace('/\s+/u', '', $name),
            preg_replace('/[・･]/u', '', $name),
            preg_replace('/\s*[\(（][^\)）]*[\)）]\s*$/u', '', $name),
        ];

        return array_values(array_unique(array_filter(array_map(
            fn ($v) => trim((string) $v),
            $candidates
        ))));
    }
}