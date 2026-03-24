<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportMonsterMapSpawnNotes extends Command
{
    protected $signature = 'monster-map-spawns:import-notes
                            {csv : CSVファイルのパス}
                            {--dry-run : 更新せずに確認だけする}
                            {--allow-empty : 空のnoteもDBに反映する}';

    protected $description = 'CSVから monster_map_spawns.note だけを更新する';

    public function handle(): int
    {
        $csvPath = $this->argument('csv');
        $dryRun = (bool) $this->option('dry-run');
        $allowEmpty = (bool) $this->option('allow-empty');

        if (!is_file($csvPath)) {
            $this->error("CSVが見つからない: {$csvPath}");
            return self::FAILURE;
        }

        $handle = fopen($csvPath, 'r');
        if ($handle === false) {
            $this->error("CSVを開けない: {$csvPath}");
            return self::FAILURE;
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            $this->error('CSVのヘッダーを読めなかった');
            return self::FAILURE;
        }

        $header = array_map(fn ($value) => $this->normalizeHeader($value), $header);

        $idIndex = $this->findHeaderIndex($header, ['id']);
        $noteIndex = $this->findHeaderIndex($header, ['note']);

        if ($idIndex === null || $noteIndex === null) {
            fclose($handle);
            $this->error('CSVに id または note カラムがない');
            $this->line('検出ヘッダー: ' . implode(', ', $header));
            return self::FAILURE;
        }

        $total = 0;
        $updated = 0;
        $skipped = 0;
        $notFound = 0;

        DB::beginTransaction();

        try {
            while (($row = fgetcsv($handle)) !== false) {
                $total++;

                $row = array_map(fn ($value) => $this->normalizeValue($value), $row);

                $id = isset($row[$idIndex]) ? (int) $row[$idIndex] : 0;
                $note = isset($row[$noteIndex]) ? $row[$noteIndex] : null;

                if ($id <= 0) {
                    $skipped++;
                    $this->warn("[SKIP] id不正: 行{$total}");
                    continue;
                }

                if (!$allowEmpty && ($note === null || $note === '')) {
                    $skipped++;
                    $this->line("[SKIP] id={$id} noteが空");
                    continue;
                }

                $exists = DB::table('monster_map_spawns')
                    ->where('id', $id)
                    ->exists();

                if (!$exists) {
                    $notFound++;
                    $this->warn("[NOT FOUND] id={$id}");
                    continue;
                }

                if ($dryRun) {
                    $updated++;
                    $preview = mb_substr((string) $note, 0, 80);
                    $this->line("[DRY RUN] id={$id} => {$preview}");
                    continue;
                }

                DB::table('monster_map_spawns')
                    ->where('id', $id)
                    ->update([
                        'note' => $note,
                        'updated_at' => now(),
                    ]);

                $updated++;
                $preview = mb_substr((string) $note, 0, 80);
                $this->info("[UPDATED] id={$id} => {$preview}");
            }

            fclose($handle);

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }
        } catch (\Throwable $e) {
            fclose($handle);
            DB::rollBack();

            $this->error($e->getMessage());
            return self::FAILURE;
        }

        $this->newLine();
        $this->info('完了');
        $this->line("total   : {$total}");
        $this->line("updated : {$updated}");
        $this->line("skipped : {$skipped}");
        $this->line("notFound: {$notFound}");

        return self::SUCCESS;
    }

    private function normalizeHeader($value): string
    {
        $value = $this->normalizeValue($value);

        $value = mb_strtolower($value);

        // 目視確認しやすいように最終trim
        return trim($value);
    }

    private function normalizeValue($value): string
    {
        $value = (string) $value;

        // UTF-8 BOM除去
        $value = str_replace("\xEF\xBB\xBF", '', $value);

        // UTF-16/UnicodeのBOMやゼロ幅文字除去
        $value = preg_replace('/\x{FEFF}|\x{200B}|\x{200C}|\x{200D}/u', '', $value);

        // 改行コード統一
        $value = str_replace(["\r\n", "\r"], "\n", $value);

        return trim($value);
    }

    private function findHeaderIndex(array $headers, array $candidates): ?int
    {
        $normalizedHeaders = array_map(
            fn ($header) => $this->normalizeValue(mb_strtolower((string) $header)),
            $headers
        );

        foreach ($candidates as $candidate) {
            $candidate = $this->normalizeValue(mb_strtolower($candidate));
            $index = array_search($candidate, $normalizedHeaders, true);

            if ($index !== false) {
                return $index;
            }
        }

        return null;
    }
}