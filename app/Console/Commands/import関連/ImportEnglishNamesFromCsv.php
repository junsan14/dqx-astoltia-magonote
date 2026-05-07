<?php

namespace App\Console\Commands;

use App\Models\Continent;
use App\Models\Map;
use App\Models\Monster;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ImportEnglishNamesFromCsv extends Command
{
    protected $signature = 'dq10:import-english-names
                            {--continents=continents_en.csv : CSV file for continents in storage/app}
                            {--maps=maps_en.csv : CSV file for maps in storage/app}
                            {--monsters=monsters_en.csv : CSV file for monsters in storage/app}
                            {--only= : continents|maps|monsters}
                            {--dry-run : Show what would be updated without saving}';

    protected $description = 'Import English names from CSV files in storage/app into continents, maps, and monsters tables';

    public function handle(): int
    {
        $only = $this->option('only');
        $dryRun = (bool) $this->option('dry-run');

        $allowed = [null, 'continents', 'maps', 'monsters'];
        if (!in_array($only, $allowed, true)) {
            $this->error('--only must be one of: continents, maps, monsters');
            return self::FAILURE;
        }

        try {
            DB::beginTransaction();

            if ($only === null || $only === 'continents') {
                $this->importContinents(
                    $this->option('continents'),
                    $dryRun
                );
            }

            if ($only === null || $only === 'maps') {
                $this->importMaps(
                    $this->option('maps'),
                    $dryRun
                );
            }

            if ($only === null || $only === 'monsters') {
                $this->importMonsters(
                    $this->option('monsters'),
                    $dryRun
                );
            }

            if ($dryRun) {
                DB::rollBack();
                $this->warn('Dry run completed. No changes were saved.');
            } else {
                DB::commit();
                $this->info('Import completed successfully.');
            }

            return self::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Import failed: ' . $e->getMessage());
            report($e);

            return self::FAILURE;
        }
    }

    protected function importContinents(string $fileName, bool $dryRun): void
    {
        $this->line('');
        $this->info("Importing continents from {$fileName}");

        $rows = $this->readCsv($fileName);

        $updated = 0;
        $skipped = 0;
        $missing = 0;

        foreach ($rows as $index => $row) {
            $lineNo = $index + 2;

            $id = $this->nullableInt($row['id'] ?? null);
            $name = $this->nullableString($row['name'] ?? null);
            $nameEn = $this->nullableString($row['name_en'] ?? null);

            if (!$id && !$name) {
                $this->warn("continents CSV line {$lineNo}: skipped because both id and name are empty.");
                $skipped++;
                continue;
            }

            if (!$nameEn) {
                $skipped++;
                continue;
            }

            $continent = null;

            if ($id) {
                $continent = Continent::find($id);
            }

            if (!$continent && $name) {
                $continent = Continent::where('name', $name)->first();
            }

            if (!$continent) {
                $this->warn("continents CSV line {$lineNo}: target not found (id={$id}, name={$name}).");
                $missing++;
                continue;
            }

            $before = $continent->name_en;
            if ($before === $nameEn) {
                $skipped++;
                continue;
            }

            $this->line("Continent #{$continent->id}: {$continent->name} => {$nameEn}");

            if (!$dryRun) {
                $continent->name_en = $nameEn;
                $continent->save();
            }

            $updated++;
        }

        $this->info("Continents done. updated={$updated}, skipped={$skipped}, missing={$missing}");
    }

    protected function importMaps(string $fileName, bool $dryRun): void
    {
        $this->line('');
        $this->info("Importing maps from {$fileName}");

        $rows = $this->readCsv($fileName);

        $updated = 0;
        $skipped = 0;
        $missing = 0;

        foreach ($rows as $index => $row) {
            $lineNo = $index + 2;

            $id = $this->nullableInt($row['id'] ?? null);
            $name = $this->nullableString($row['name'] ?? null);
            $nameEn = $this->nullableString($row['name_en'] ?? null);
            $continentId = $this->nullableInt($row['continent_id'] ?? null);
            $mapType = $this->nullableString($row['map_type'] ?? null);

            if (!$id && !$name) {
                $this->warn("maps CSV line {$lineNo}: skipped because both id and name are empty.");
                $skipped++;
                continue;
            }

            if (!$nameEn) {
                $skipped++;
                continue;
            }

            $map = null;

            if ($id) {
                $map = Map::find($id);
            }

            if (!$map && $name) {
                $query = Map::where('name', $name);

                if ($continentId) {
                    $query->where('continent_id', $continentId);
                }

                if ($mapType) {
                    $query->where('map_type', $mapType);
                }

                $map = $query->first();
            }

            if (!$map) {
                $this->warn("maps CSV line {$lineNo}: target not found (id={$id}, name={$name}).");
                $missing++;
                continue;
            }

            $before = $map->name_en;
            if ($before === $nameEn) {
                $skipped++;
                continue;
            }

            $this->line("Map #{$map->id}: {$map->name} => {$nameEn}");

            if (!$dryRun) {
                $map->name_en = $nameEn;
                $map->save();
            }

            $updated++;
        }

        $this->info("Maps done. updated={$updated}, skipped={$skipped}, missing={$missing}");
    }

    protected function importMonsters(string $fileName, bool $dryRun): void
    {
        $this->line('');
        $this->info("Importing monsters from {$fileName}");

        $rows = $this->readCsv($fileName);

        $updated = 0;
        $skipped = 0;
        $missing = 0;

        foreach ($rows as $index => $row) {
            $lineNo = $index + 2;

            $id = $this->nullableInt($row['id'] ?? null);
            $name = $this->nullableString($row['name'] ?? null);
            $nameEn = $this->nullableString($row['name_en'] ?? null);
            $systemTypeEn = $this->nullableString($row['system_type_en'] ?? null);

            if (!$id && !$name) {
                $this->warn("monsters CSV line {$lineNo}: skipped because both id and name are empty.");
                $skipped++;
                continue;
            }

            if (!$nameEn && !$systemTypeEn) {
                $skipped++;
                continue;
            }

            $monster = null;

            if ($id) {
                $monster = Monster::find($id);
            }

            if (!$monster && $name) {
                $monster = Monster::where('name', $name)->first();
            }

            if (!$monster) {
                $this->warn("monsters CSV line {$lineNo}: target not found (id={$id}, name={$name}).");
                $missing++;
                continue;
            }

            $newNameEn = $nameEn ?: $monster->name_en;
            $newSystemTypeEn = $systemTypeEn ?: $monster->system_type_en;

            $nameChanged = $monster->name_en !== $newNameEn;
            $systemTypeChanged = $monster->system_type_en !== $newSystemTypeEn;

            if (!$nameChanged && !$systemTypeChanged) {
                $skipped++;
                continue;
            }

            $this->line(
                "Monster #{$monster->id}: {$monster->name}"
                . ($nameChanged ? " | name_en: {$monster->name_en} => {$newNameEn}" : '')
                . ($systemTypeChanged ? " | system_type_en: {$monster->system_type_en} => {$newSystemTypeEn}" : '')
            );

            if (!$dryRun) {
                if ($nameChanged) {
                    $monster->name_en = $newNameEn;
                }

                if ($systemTypeChanged) {
                    $monster->system_type_en = $newSystemTypeEn;
                }

                $monster->save();
            }

            $updated++;
        }

        $this->info("Monsters done. updated={$updated}, skipped={$skipped}, missing={$missing}");
    }

    /**
     * @return array<int, array<string, string|null>>
     */
    protected function readCsv(string $fileName): array
{
    $fullPath = storage_path('app/' . ltrim($fileName, '/'));

    if (!is_file($fullPath)) {
        throw new \RuntimeException("File not found: {$fullPath}");
    }

    $handle = fopen($fullPath, 'r');
    if ($handle === false) {
        throw new \RuntimeException("Unable to open CSV: {$fullPath}");
    }

    $rows = [];

    try {
        $headers = fgetcsv($handle);
        if ($headers === false) {
            throw new \RuntimeException("CSV is empty: {$fullPath}");
        }

        $headers = array_map(function ($value) {
            $value = (string) $value;
            $value = preg_replace('/^\xEF\xBB\xBF/', '', $value);
            return trim($value);
        }, $headers);

        while (($data = fgetcsv($handle)) !== false) {
            if ($this->isEmptyCsvRow($data)) {
                continue;
            }

            $row = [];
            foreach ($headers as $index => $header) {
                $row[$header] = array_key_exists($index, $data) ? $data[$index] : null;
            }

            $rows[] = $row;
        }
    } finally {
        fclose($handle);
    }

    return $rows;
}

    protected function isEmptyCsvRow(array $row): bool
    {
        foreach ($row as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    protected function nullableString($value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        if ($value === '' || strtolower($value) === 'null') {
            return null;
        }

        return $value;
    }

    protected function nullableInt($value): ?int
    {
        $value = $this->nullableString($value);

        if ($value === null) {
            return null;
        }

        if (!is_numeric($value)) {
            return null;
        }

        return (int) $value;
    }
}