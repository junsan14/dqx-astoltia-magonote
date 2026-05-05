<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExportTableCsv extends Command
{
    protected $signature = 'db:export 
        {table : Export target table name}
        {--path=exports : Output directory under storage/app}
        {--no-header : Export CSV without header row}
        {--exclude-id : Exclude id column}';

    protected $description = 'Export any table to CSV';

    public function handle(): int
    {
        $table = $this->argument('table');
        $directory = trim($this->option('path'), '/');
        $withHeader = ! $this->option('no-header');
        $excludeId = (bool) $this->option('exclude-id');

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

        $fileNameParts = [$table];

        if (! $withHeader) {
            $fileNameParts[] = 'no_header';
        }

        if ($excludeId) {
            $fileNameParts[] = 'no_id';
        }

        $fileName = implode('_', $fileNameParts) . '.csv';
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
        $this->info("Columns: " . implode(', ', $columns));
        $this->info("Exported to: {$path}");

        return self::SUCCESS;
    }
}