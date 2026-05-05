<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExportDbCommand extends Command
{
    protected $signature = 'export:db
        {table : Export target table name}
        {--path=exports : Output directory under storage/app}
        {--no-header : Export CSV without header row}
        {--exclude-id : Exclude id column}
        {--keep-old : Do not delete old export files for this table}';

    protected $description = 'Export table data to CSV. Example: php artisan export:db accessories';

    public function handle(): int
    {
        $table = $this->argument('table');

        $directory = trim($this->option('path'), '/');
        $withHeader = ! $this->option('no-header');
        $excludeId = (bool) $this->option('exclude-id');
        $keepOld = (bool) $this->option('keep-old');

        if (! Schema::hasTable($table)) {
            $this->error("Table not found: {$table}");
            return self::FAILURE;
        }

        $rows = DB::table($table)->get();

        if ($rows->isEmpty()) {
            $this->error("No data found in {$table}");
            return self::FAILURE;
        }

        $outputDir = storage_path("app/{$directory}");

        if (! is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        if (! $keepOld) {
            $this->deleteOldExportFiles($outputDir, $table);
        }

        $timestamp = now()->format('Ymd_His');

        // ファイル名は accessories_20260505_093754.csv 形式
        $fileName = "{$table}_{$timestamp}.csv";
        $path = "{$outputDir}/{$fileName}";

        $fp = fopen($path, 'w');

        if (! $fp) {
            $this->error("Could not open file: {$path}");
            return self::FAILURE;
        }

        $firstRow = (array) $rows->first();
        $columns = array_keys($firstRow);

        if ($excludeId) {
            $columns = array_values(array_filter($columns, function ($column) {
                return $column !== 'id';
            }));
        }

        if ($withHeader) {
            fputcsv($fp, $columns);
        }

        foreach ($rows as $row) {
            $rowArray = (array) $row;
            $line = [];

            foreach ($columns as $column) {
                $line[] = $rowArray[$column] ?? null;
            }

            fputcsv($fp, $line);
        }

        fclose($fp);

        $this->info("Exported {$rows->count()} rows.");
        $this->info("Table: {$table}");
        $this->info("File: storage/app/{$directory}/{$fileName}");
        $this->info("Full path: {$path}");

        return self::SUCCESS;
    }

    private function deleteOldExportFiles(string $outputDir, string $table): void
    {
        $patterns = [
            "{$outputDir}/{$table}.csv",
            "{$outputDir}/{$table}_*.csv",
        ];

        $deleted = 0;

        foreach ($patterns as $pattern) {
            foreach (glob($pattern) ?: [] as $file) {
                if (is_file($file)) {
                    unlink($file);
                    $deleted++;
                }
            }
        }

        if ($deleted > 0) {
            $this->warn("Deleted old export files for {$table}: {$deleted}");
        }
    }
}