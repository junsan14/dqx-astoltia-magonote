<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ImportAccessoriesShortcut extends Command
{
    protected $signature = 'import:accessories 
        {file : CSV filename in storage/app/exports. Example: accessories_20260505_093754.csv}
        {--dry-run : Check only, do not write}';

    protected $description = 'Shortcut command to import accessories CSV';

    public function handle(): int
    {
        $file = $this->argument('file');
        $dryRun = (bool) $this->option('dry-run');

        $command = [
            'table' => 'accessories',
            '--key' => 'item_id',
            '--file' => "exports/{$file}",
        ];

        if ($dryRun) {
            $command['--dry-run'] = true;
        }

        return $this->call('db:import-csv', $command);
    }
}