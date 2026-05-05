<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ImportTableCsv extends Command
{
    protected $signature = 'db:import-csv
        {table : Import target table name}
        {--file= : CSV path under storage/app. Example: exports/accessories_no_header.csv}
        {--key= : Upsert key column. Example: item_id, name, boss_id}
        {--csv-excludes-id : Use this when CSV does not contain id column}
        {--keep-id : Insert/update id from CSV. Usually not recommended}
        {--dry-run : Check only, do not write}';

    protected $description = 'Import CSV into any table with upsert';

    public function handle(): int
    {
        $table = $this->argument('table');
        $file = $this->option('file') ?: "exports/{$table}.csv";
        $key = $this->option('key');
        $csvExcludesId = (bool) $this->option('csv-excludes-id');
        $keepId = (bool) $this->option('keep-id');
        $dryRun = (bool) $this->option('dry-run');

        if (! Schema::hasTable($table)) {
            $this->error("Table not found: {$table}");
            return self::FAILURE;
        }

        $path = storage_path("app/{$file}");

        if (! file_exists($path)) {
            $this->error("CSV file not found: {$path}");
            return self::FAILURE;
        }

        $tableColumns = Schema::getColumnListing($table);

        if (empty($tableColumns)) {
            $this->error("No columns found in table: {$table}");
            return self::FAILURE;
        }

        $key = $key ?: $this->guessKeyColumn($tableColumns);

        if (! $key) {
            $this->error('Could not guess upsert key.');
            $this->line('Please specify --key=item_id or --key=name etc.');
            return self::FAILURE;
        }

        if (! in_array($key, $tableColumns, true)) {
            $this->error("Key column '{$key}' does not exist in {$table}.");
            return self::FAILURE;
        }

        $handle = fopen($path, 'r');

        if (! $handle) {
            $this->error("Could not open file: {$path}");
            return self::FAILURE;
        }

        $firstLine = fgetcsv($handle);

        if ($firstLine === false) {
            $this->error('CSV is empty.');
            fclose($handle);
            return self::FAILURE;
        }

        $hasHeader = $this->looksLikeHeader($firstLine, $tableColumns);

        if ($hasHeader) {
            $csvColumns = $firstLine;
            $this->info('Header row detected.');
        } else {
            $csvColumns = $tableColumns;

            if ($csvExcludesId) {
                $csvColumns = array_values(array_filter($csvColumns, function ($column) {
                    return $column !== 'id';
                }));
            }

            rewind($handle);
        }

        $missingColumns = array_values(array_diff($csvColumns, $tableColumns));

        if (! empty($missingColumns)) {
            $this->error('CSV has columns that do not exist in table:');
            $this->line(implode(', ', $missingColumns));
            fclose($handle);
            return self::FAILURE;
        }

        if (! in_array($key, $csvColumns, true)) {
            $this->error("Key column '{$key}' is not included in CSV columns.");
            fclose($handle);
            return self::FAILURE;
        }

        $this->info("Table: {$table}");
        $this->info("File: storage/app/{$file}");
        $this->info("Key: {$key}");
        $this->info('CSV columns: ' . implode(', ', $csvColumns));

        if (! $keepId && in_array('id', $csvColumns, true)) {
            $this->warn('id column exists in CSV, but it will be ignored. Use --keep-id if you really want to import id.');
        }

        if ($dryRun) {
            $this->warn('Dry run mode. No data will be written.');
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $lineNumber = $hasHeader ? 1 : 0;

        DB::beginTransaction();

        try {
            while (($values = fgetcsv($handle)) !== false) {
                $lineNumber++;

                if ($this->isEmptyCsvRow($values)) {
                    $skipped++;
                    continue;
                }

                if (count($values) !== count($csvColumns)) {
                    throw new \RuntimeException(
                        "Invalid column count on line {$lineNumber}. Expected "
                        . count($csvColumns)
                        . ', actual '
                        . count($values)
                        . '. Values: '
                        . json_encode($values, JSON_UNESCAPED_UNICODE)
                    );
                }

                $row = array_combine($csvColumns, $values);

                if (empty($row[$key])) {
                    $skipped++;
                    continue;
                }

                $data = $this->normalizeRowForDb($row, $tableColumns);

                if (! $keepId) {
                    unset($data['id']);
                }

                if (in_array('updated_at', $tableColumns, true)) {
                    $data['updated_at'] = now();
                }

                if (
                    in_array('created_at', $tableColumns, true)
                    && empty($data['created_at'])
                ) {
                    $data['created_at'] = now();
                }

                $exists = DB::table($table)
                    ->where($key, $row[$key])
                    ->exists();

                if ($exists) {
                    $updated++;

                    if (! $dryRun) {
                        DB::table($table)
                            ->where($key, $row[$key])
                            ->update($data);
                    }
                } else {
                    $created++;

                    if (! $dryRun) {
                        DB::table($table)->insert($data);
                    }
                }
            }

            fclose($handle);

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }

            $this->info("Created: {$created}");
            $this->info("Updated: {$updated}");
            $this->info("Skipped: {$skipped}");

            return self::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();

            if (is_resource($handle)) {
                fclose($handle);
            }

            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }

    private function guessKeyColumn(array $columns): ?string
    {
        $candidates = [
            'item_id',
            'boss_id',
            'monster_id',
            'map_id',
            'slug',
            'key',
            'name',
            'id',
        ];

        foreach ($candidates as $candidate) {
            if (in_array($candidate, $columns, true)) {
                return $candidate;
            }
        }

        return null;
    }

    private function looksLikeHeader(array $firstLine, array $tableColumns): bool
    {
        if (empty($firstLine)) {
            return false;
        }

        $matched = 0;

        foreach ($firstLine as $value) {
            if (in_array($value, $tableColumns, true)) {
                $matched++;
            }
        }

        return $matched >= max(1, floor(count($firstLine) * 0.6));
    }

    private function isEmptyCsvRow(array $values): bool
    {
        foreach ($values as $value) {
            if ($value !== null && $value !== '') {
                return false;
            }
        }

        return true;
    }

    private function normalizeRowForDb(array $row, array $tableColumns): array
    {
        $data = [];

        foreach ($row as $column => $value) {
            if (! in_array($column, $tableColumns, true)) {
                continue;
            }

            if ($value === '') {
                $data[$column] = null;
                continue;
            }

            $data[$column] = $value;
        }

        return $data;
    }
}