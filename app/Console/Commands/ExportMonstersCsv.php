<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExportMonstersCsv extends Command
{
    protected $signature = 'dq10:export-monsters';
    protected $description = 'Export monsters table to CSV';

    public function handle()
    {
        $monsters = DB::table('monsters')->get();

        $path = storage_path('app/monsters.csv');

        $fp = fopen($path, 'w');

        // header
        fputcsv($fp, array_keys((array)$monsters->first()));

        foreach ($monsters as $monster) {
            fputcsv($fp, (array)$monster);
        }

        fclose($fp);

        $this->info("CSV exported: $path");
    }
}
