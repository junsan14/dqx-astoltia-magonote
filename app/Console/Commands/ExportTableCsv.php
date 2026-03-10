<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExportTableCsv extends Command
{
    protected $signature = 'db:export {table}';
    protected $description = 'Export any table to CSV';
    
    public function handle()
    {
        $table = $this->argument('table');

        $rows = DB::table($table)->get();

        if ($rows->isEmpty()) {
            $this->error("No data found in {$table}");
            return;
        }

        $path = storage_path("app/{$table}.csv");

        $fp = fopen($path, 'w');

        // header
        fputcsv($fp, array_keys((array)$rows->first()));

        foreach ($rows as $row) {
            fputcsv($fp, (array)$row);
        }

        fclose($fp);

        $this->info("Exported to: {$path}");
    }
}