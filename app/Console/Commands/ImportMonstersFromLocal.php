<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportMonstersFromLocal extends Command
{
    protected $signature = 'dq10:import-monsters-from-local';

    protected $description = 'Import monster names from local file';

    public function handle()
    {
        $path = storage_path('app/monsters.txt');

        if (!file_exists($path)) {
            $this->error("File not found: {$path}");
            return;
        }

        $lines = file($path);

        $rows = [];

        foreach ($lines as $line) {
            $name = trim($line);

            if ($name) {
                $rows[] = [
                    'name' => $name
                ];
            }
        }

        DB::table('monsters')->insert($rows);

        $this->info('Import completed: '.count($rows).' monsters');
    }
}
