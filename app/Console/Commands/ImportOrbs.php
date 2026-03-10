<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class ImportOrbs extends Command
{
    protected $signature = 'dq10:import-orbs {url}';
    protected $description = 'Import orb data from wiki page';

    public function handle()
    {
        $url = $this->argument('url');

        $this->info("fetching: $url");

        $html = Http::get($url)->body();

        $crawler = new Crawler($html);

        // 色判定
        $color = null;

        if (str_contains($url, '炎')) $color = '炎';
        if (str_contains($url, '水')) $color = '水';
        if (str_contains($url, '風')) $color = '風';
        if (str_contains($url, '光')) $color = '光';
        if (str_contains($url, '闇')) $color = '闇';

        $rows = $crawler->filter('table tr');

foreach ($rows as $row) {

    $cols = (new Crawler($row))->filter('td');

    // tdがない＝ヘッダーなのでスキップ
    if ($cols->count() === 0) {
        continue;
    }

    $name = trim($cols->eq(0)->text());
    $effect = trim($cols->eq(1)->text());

    // 念のためゴミデータ防止
    if ($name === '名称' || $name === 'Lv1毎') {
        continue;
    }

    DB::table('orbs')->updateOrInsert(
        ['name' => $name],
        [
            'color' => $color,
            'effect' => $effect,
            //'source_url' => $url,
            'created_at' => now(),
            'updated_at' => now(),
        ]
    );

    $this->info("imported: $name");
}

        $this->info("done");
    }
}