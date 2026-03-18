<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportItemPrices extends Command
{
    protected $signature = 'items:import-prices {file}';
    protected $description = 'Import buy_price from CSV by matching item name';

    public function handle()
    {
        $file = $this->argument('file');

        if (!file_exists($file)) {
            $this->error("File not found: $file");
            return;
        }

        $handle = fopen($file, 'r');

        // ヘッダー読み飛ばし
        fgetcsv($handle);

        $updated = 0;
        $notFound = [];

        while (($row = fgetcsv($handle)) !== false) {
            $name = trim($row[0]);
            $price = (int)$row[1];

            $count = DB::table('items')
                ->where('name', $name)
                ->update([
                    'buy_price' => $price
                ]);

            if ($count) {
                $updated++;
            } else {
                $notFound[] = $name;
            }
        }

        fclose($handle);

        $this->info("Updated items: $updated");

        if (!empty($notFound)) {
            $this->warn("Not found:");
            foreach ($notFound as $name) {
                $this->line(" - $name");
            }
        }
    }
}