<?php

namespace App\Console\Commands;

use App\Models\Monster;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class ImportDq10MonsterList extends Command
{
    protected $signature = 'dq10:import-monster-list
                            {--from=1}
                            {--to=8}
                            {--limit=0}
                            {--sleep=300}
                            {--fresh}';

    protected $description = 'Import DQ10 monster list';

    public function handle(): int
    {
        $from = (int)$this->option('from');
        $to = (int)$this->option('to');
        $limit = (int)$this->option('limit');
        $sleep = (int)$this->option('sleep');
        $fresh = $this->option('fresh');

        if ($fresh) {

            $this->warn('fresh: monsters truncate');

            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            DB::table('monsters')->truncate();
            DB::statement('SET FOREIGN_KEY_CHECKS=1');

        }

        $all = [];

        for ($page = $from; $page <= $to; $page++) {

            $url = $this->buildListUrl($page);

            $this->line("fetch: {$url}");

            $html = $this->fetch($url);

            if (!$html) {
                $this->warn("fail: {$url}");
                continue;
            }

            $items = $this->extractListItems($html,$url);

            if ($limit > 0) {
                $items = array_slice($items,0,$limit);
            }

            $this->info("page {$page}: ".count($items));

            $all = array_merge($all,$items);
        }

        if (count($all) === 0) {
            $this->error('no monsters');
            return self::FAILURE;
        }

        $this->info('total: '.count($all));

        $bar = $this->output->createProgressBar(count($all));
        $bar->start();

        $order = 1;

        foreach ($all as $item) {

            try {

                usleep($sleep * 1000);

                $detail = $this->fetch($item['detail_url']);

                $system = null;

                if ($detail) {

                    $crawler = new Crawler($detail);

                    $system = $this->extractSystemType($crawler);
                }

                Monster::updateOrCreate(
                    ['source_url'=>$item['detail_url']],
                    [
                        'display_order'=>$order,
                        'name'=>$item['name'],
                        'system_type'=>$system,
                        'source_url'=>$item['detail_url']
                    ]
                );

                $order++;

            } catch (\Throwable $e) {

                $this->newLine();
                $this->error($item['detail_url']);
                $this->line($e->getMessage());
            }

            $bar->advance();
        }

        $bar->finish();

        $this->newLine();
        $this->info('done');

        return self::SUCCESS;
    }

    private function buildListUrl(int $page): string
    {
        return "https://www.d-quest-10.com/list/o_zukan_{$page}/zukan_1.html";
    }

    private function fetch(string $url): ?string
    {
        try {

            $res = Http::withHeaders([
                'User-Agent'=>'Mozilla/5.0'
            ])
            ->timeout(30)
            ->retry(2,1000)
            ->get($url);

            if (!$res->successful()) return null;

            $body = $res->body();

            $encoding = mb_detect_encoding($body,['UTF-8','SJIS-win','EUC-JP'],true);

            if ($encoding && $encoding !== 'UTF-8') {
                $body = mb_convert_encoding($body,'UTF-8',$encoding);
            }

            return $body;

        } catch (\Throwable $e) {

            return null;
        }
    }

    /**
     * 一覧ページ解析
     */
    private function extractListItems(string $html,string $base): array
    {
        $crawler = new Crawler($html,$base);

        $items = [];
        $seen = [];

        $crawler->filter('a[href*="/detail/"]')->each(function($node) use (&$items,&$seen,$base){

            $href = trim($node->attr('href'));
            $name = trim($node->text());

            if (!$href || !$name) return;

            $url = $this->resolveUrl($href,$base);

            if (!preg_match('#/detail/[a-z]\d+\.html$#i',$url)) return;

            if (isset($seen[$url])) return;

            $seen[$url] = true;

            $items[] = [
                'name'=>$name,
                'detail_url'=>$url
            ];
        });

        return $items;
    }

    /**
     * 系統取得
     */
    private function extractSystemType(Crawler $crawler): ?string
    {
        foreach ($crawler->filter('td') as $td) {

            $node = new Crawler($td);

            $text = $node->text();

            if (!str_contains($text,'系統')) continue;

            foreach ($node->filter('a') as $a) {

                $aNode = new Crawler($a);

                $value = trim($aNode->text());

                if ($value) return $value;
            }
        }

        return null;
    }

    private function resolveUrl(string $href,string $base): string
    {
        if (preg_match('#^https?://#',$href)) return $href;

        $base = parse_url($base);

        $scheme = $base['scheme'];
        $host = $base['host'];

        if (str_starts_with($href,'/')) {
            return "{$scheme}://{$host}{$href}";
        }

        return "{$scheme}://{$host}/{$href}";
    }
}