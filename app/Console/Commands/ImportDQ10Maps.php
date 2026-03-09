<?php

namespace App\Console\Commands;

use App\Models\Map;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class ImportDQ10Maps extends Command
{
    protected $signature = 'dq10:import-maps';

    protected $description = 'Import map list from dq10data';

    private string $url = 'http://www.dq10data.com/map.html';

    public function handle(): int
    {
        $html = Http::get($this->url)->body();

        $text = strip_tags($html);

        $lines = preg_split('/\R/u', $text);

        $continent = null;
        $mapType = null;

        foreach ($lines as $line) {

            $line = trim($line);

            if ($line === '') {
                continue;
            }

            // 大陸
            if (str_contains($line,'大陸')) {

                $continent = $line;
                $this->line("continent: $continent");

                continue;
            }

            // 種類
            if (in_array($line,['フィールド','ダンジョン','町','村','城'])) {

                $mapType = $line;
                $this->line("type: $mapType");

                continue;
            }

            if (!$continent || !$mapType) {
                continue;
            }

            Map::updateOrCreate(
                [
                    'continent' => $continent,
                    'name' => $line
                ],
                [
                    'map_type' => $mapType,
                    'source_url' => $this->url
                ]
            );

            $this->line("map: $line");

        }

        $this->info('Map import completed.');

        return self::SUCCESS;
    }
}