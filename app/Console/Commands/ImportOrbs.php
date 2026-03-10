<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class ImportOrbs extends Command
{
    protected $signature = 'dq10:import-orbs 
                            {--color=all}
                            {--fresh : delete all orb data before import}';

    protected $description = 'Import orb data from wiki';

    private $urls = [
        '炎' => 'https://wikiwiki.jp/dq10dic2nd/%E5%AE%9D%E7%8F%A0/%E7%82%8E',
        '水' => 'https://wikiwiki.jp/dq10dic2nd/%E5%AE%9D%E7%8F%A0/%E6%B0%B4',
        '風' => 'https://wikiwiki.jp/dq10dic2nd/%E5%AE%9D%E7%8F%A0/%E9%A2%A8',
        '光' => 'https://wikiwiki.jp/dq10dic2nd/%E5%AE%9D%E7%8F%A0/%E5%85%89',
        '闇' => 'https://wikiwiki.jp/dq10dic2nd/%E5%AE%9D%E7%8F%A0/%E9%97%87',
    ];

    public function handle()
    {
        // fresh option
        if ($this->option('fresh')) {
            $this->warn("fresh option detected: deleting all orbs...");
            DB::table('orbs')->truncate();
        }

        $colorOption = $this->option('color');

        if ($colorOption === 'all') {
            $targets = $this->urls;
        } else {
            if (!isset($this->urls[$colorOption])) {
                $this->error("invalid color: {$colorOption}");
                return Command::FAILURE;
            }

            $targets = [
                $colorOption => $this->urls[$colorOption]
            ];
        }

        foreach ($targets as $color => $url) {

            $this->info("fetching {$color}: {$url}");

            $response = Http::withOptions([
                'verify' => true
            ])->get($url);

            if (!$response->successful()) {
                $this->error("failed: {$url}");
                continue;
            }

            $html = $response->body();

            $crawler = new Crawler($html);

            $rows = $crawler->filter('table tr');

            foreach ($rows as $row) {

                $cols = (new Crawler($row))->filter('td');

                if ($cols->count() < 2) {
                    continue;
                }

                $name = trim($cols->eq(0)->text(''));
                $effect = trim($cols->eq(1)->text(''));
                // 全角スペース整理
                $name = str_replace('　', ' ', $name);

                // 先頭の☆を削除
                $name = preg_replace('/^☆+/u', '', $name);

                // （旧：～）削除
                $name = preg_replace('/\s*[\(（]旧：.*?[\)）]/u', '', $name);

                $name = trim($name);
                $name = str_replace('　', ' ', $name);
                $name = preg_replace('/\s*[\(（]旧：.*?[\)）]/u', '', $name);
                $name = trim($name);

                if (
                    $name === '' ||
                    $name === '名称' ||
                    $name === 'Lv1毎'
                ) {
                    continue;
                }

                DB::table('orbs')->updateOrInsert(
                    ['name' => $name],
                    [
                        'color' => $color,
                        'effect' => $effect,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );

                $this->info("imported: {$name} ({$color})");
            }
        }

        $this->info("done");

        return Command::SUCCESS;
    }
}
