<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class TestMapSpawn extends Command
{
    protected $signature = 'dq10:test-spawn';

    protected $description = 'test spawn scraping';

    public function handle()
    {

        $url = "http://www.dq10data.com/map_o_02.html";

        $html = Http::get($url)->body();

        $crawler = new Crawler($html);

        // 各エリア
        $crawler->filter('h4')->each(function ($h4) {

            $area = trim($h4->text());

            $this->line("AREA: ".$area);

            // 次の div.table-responsive を取得
            $table = $h4->nextAll()
                        ->filter('.table-responsive')
                        ->first();

            if (!$table->count()) {
                return;
            }

            // モンスター行
            $table->filter('tbody tr')->each(function ($tr) use ($area) {

                $tds = $tr->filter('td');

                if ($tds->count() === 0) {
                    return;
                }

                $monster = trim($tds->eq(0)->text());

                $this->line($monster." : ".$area);

            });

        });

    }
}