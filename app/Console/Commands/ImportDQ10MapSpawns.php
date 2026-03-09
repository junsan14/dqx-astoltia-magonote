<?php

namespace App\Console\Commands;

use App\Models\Map;
use App\Models\Monster;
use App\Models\MonsterMapSpawn;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class ImportDQ10MapSpawns extends Command
{
    protected $signature = 'dq10:import-spawns {--limit=5}';
    protected $description = 'Import monster spawn data from dq10data map pages';

    private string $indexUrl = 'http://www.dq10data.com/map.html';
    private string $baseUrl = 'http://www.dq10data.com/';

    public function handle(): int
    {
        $limit = (int) $this->option('limit');

        $indexHtml = $this->fetch($this->indexUrl);

        if (! $indexHtml) {
            $this->error('map.html の取得に失敗');
            return self::FAILURE;
        }

        $mapLinks = $this->extractMapLinks($indexHtml);

        if ($limit > 0) {
            $mapLinks = array_slice($mapLinks, 0, $limit);
        }

        $this->info('target map pages: ' . count($mapLinks));

        foreach ($mapLinks as $mapLink) {
            $this->newLine();
            $this->info('PAGE: ' . $mapLink['url']);

            $html = $this->fetch($mapLink['url']);
            if (! $html) {
                $this->warn('skip: fetch failed');
                continue;
            }

            $result = $this->parseMapPage($html, $mapLink['url']);

            $mapName = $result['map_name'] ?: $mapLink['name_hint'];

            if (! $mapName) {
                $this->warn('skip: map name not found');
                continue;
            }

            $map = Map::where('name', $mapName)->first();

            if (! $map) {
                $this->warn("skip: map not found in DB => {$mapName}");
                continue;
            }

            foreach ($result['spawns'] as $spawn) {
                $monster = Monster::where('name', $spawn['monster_name'])->first();

                if (! $monster) {
                    $this->warn("monster not found => {$spawn['monster_name']}");
                    continue;
                }

                MonsterMapSpawn::updateOrCreate(
                    [
                        'monster_id' => $monster->id,
                        'map_id' => $map->id,
                        'area' => $spawn['area'],
                    ],
                    [
                        'spawn_time' => $spawn['spawn_time'],
                        'spawn_count' => $spawn['spawn_count'],
                    ]
                );

                $this->line(
                    "{$spawn['monster_name']} | {$mapName} | {$spawn['area']} | {$spawn['spawn_time']} | " .
                    ($spawn['spawn_count'] ?? '-')
                );
            }
        }

        $this->newLine();
        $this->info('IMPORT COMPLETE');

        return self::SUCCESS;
    }

    private function fetch(string $url): ?string
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0',
                'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
                'Referer' => $this->baseUrl,
            ])->timeout(20)->retry(2, 1000)->get($url);

            if (! $response->successful()) {
                return null;
            }

            $body = $response->body();

            $encoding = mb_detect_encoding(
                $body,
                ['UTF-8', 'SJIS-win', 'SJIS', 'EUC-JP', 'ISO-2022-JP'],
                true
            );

            if ($encoding && $encoding !== 'UTF-8') {
                $body = mb_convert_encoding($body, 'UTF-8', $encoding);
            }

            return $body;
        } catch (\Throwable $e) {
            $this->warn("fetch error: {$url}");
            $this->warn($e->getMessage());
            return null;
        }
    }

    private function extractMapLinks(string $html): array
    {
        $crawler = new Crawler($html, $this->indexUrl);
        $items = [];

        foreach ($crawler->filter('a[href]') as $a) {
            $href = trim((string) $a->getAttribute('href'));
            $text = trim($a->textContent ?? '');

            if ($href === '') {
                continue;
            }

            if (! preg_match('/^map_[a-z]+_\d+\.html$/i', $href)) {
                continue;
            }

            $items[] = [
                'url' => $this->baseUrl . ltrim($href, '/'),
                'name_hint' => $text !== '' ? $text : null,
            ];
        }

        $unique = [];
        foreach ($items as $item) {
            $unique[$item['url']] = $item;
        }

        return array_values($unique);
    }

    private function parseMapPage(string $html, string $url): array
    {
        $crawler = new Crawler($html, $url);

        $mapName = null;

        if ($crawler->filter('h1')->count()) {

    $mapName = trim($crawler->filter('h1')->first()->text());

    $mapName = str_replace(['　',' 全体図'],'',$mapName);
}

        $spawns = [];

        $crawler->filter('h4')->each(function (Crawler $h4) use (&$spawns) {
            $areaText = trim($h4->text(''));

            if ($areaText === '') {
                return;
            }

            if (str_contains($areaText, 'お供')) {
                return;
            }

            [$area, $spawnTime, $spawnCount] = $this->parseAreaMeta($areaText);

            $tableWrap = $this->findFirstFollowingTableWrap($h4);

            if (! $tableWrap || ! $tableWrap->count()) {
                return;
            }

            $tableWrap->filter('tbody tr')->each(function (Crawler $tr) use (&$spawns, $area, $spawnTime, $spawnCount) {
                $tds = $tr->filter('td');

                if ($tds->count() < 1) {
                    return;
                }

                $monsterName = trim($tds->eq(0)->text(''));

                if ($monsterName === '' || $monsterName === 'モンスター名') {
                    return;
                }

                $spawns[] = [
                    'monster_name' => $monsterName,
                    'area' => $area,
                    'spawn_time' => $spawnTime,
                    'spawn_count' => $spawnCount,
                ];
            });
        });

        return [
            'map_name' => $mapName,
            'spawns' => $spawns,
        ];
    }

    private function findFirstFollowingTableWrap(Crawler $h4): ?Crawler
    {
        $node = $h4->getNode(0);

        while ($node = $node->nextSibling) {
            if ($node->nodeType !== XML_ELEMENT_NODE) {
                continue;
            }

            $crawler = new Crawler($node);

            $class = (string) $node->attributes?->getNamedItem('class')?->nodeValue;
            if (str_contains($class, 'table-responsive')) {
                return $crawler;
            }

            // 別要素を挟んでも、その中に table-responsive があれば拾う
            if ($crawler->filter('.table-responsive')->count()) {
                return $crawler->filter('.table-responsive')->first();
            }

            // 次の h4 まで来たら打ち切り
            if (strtolower($node->nodeName) === 'h4') {
                break;
            }
        }

        return null;
    }

    private function parseAreaMeta(string $areaText): array
    {
        $spawnTime = 'normal';
        $spawnCount = null;

        if (str_contains($areaText, '夜')) {
            $spawnTime = 'night';
        }

        if (str_contains($areaText, '昼')) {
            $spawnTime = 'day';
        }

        if (preg_match('/（(.+?)）/u', $areaText, $m)) {
            $spawnCount = trim($m[1]);
        }

        $area = preg_replace('/（.+?）/u', '', $areaText);
        $area = str_replace(['夜のみ', '昼のみ', '夜', '昼'], '', $area);
        $area = trim($area);

        if ($area === '') {
            $area = null;
        }

        return [$area, $spawnTime, $spawnCount];
    }
}