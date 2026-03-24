<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\DomCrawler\Crawler;
use Throwable;

class ExportMonsterMapNotesFromDqWiki extends Command
{
    protected $signature = 'dqx:export-monster-map-notes
        {--pages= : 一覧ページ番号をカンマ区切りで指定。例: 1,2,3}
        {--all-pages : 1ページ目から57ページ目まで全部取得する}
        {--monster= : 特定モンスター名だけ出力}
        {--output= : 出力先パス(storage/app 配下)。未指定なら自動生成}
    ';

    protected $description = 'DQ10 100匹討伐隊wiki の一覧ページからモンスターページをたどり、地名とnoteをCSV出力する';

    protected string $baseUrl = 'https://dq100buster.wiki.fc2.com';

    protected int $maxPage = 57;

    public function handle(): int
    {
        $pages = $this->resolvePages();

        if ($pages->isEmpty()) {
            $this->error('対象ページがありません。--all-pages か --pages=1,2 のどちらかを指定してくれ');
            return self::FAILURE;
        }

        $monsterOnly = trim((string) $this->option('monster', ''));
        $output = trim((string) $this->option('output', ''));

        $monsterLinks = collect();

        foreach ($pages as $pageNo) {
            $url = $this->buildListPageUrl($pageNo);

            $this->line("==== 一覧ページ取得 page={$pageNo} url={$url}");

            try {
                $html = $this->fetchHtml($url);
                $links = $this->extractMonsterLinksFromListPage($html, $pageNo);

                $this->info("page={$pageNo} で " . $links->count() . " 件のモンスターリンクを検出");

                $monsterLinks = $monsterLinks->merge($links);
            } catch (Throwable $e) {
                $this->error("一覧ページ取得失敗 page={$pageNo}: {$e->getMessage()}");
            }
        }

        $monsterLinks = $monsterLinks
            ->unique('url')
            ->values();

        if ($monsterOnly !== '') {
            $monsterLinks = $monsterLinks
                ->filter(fn ($row) => Str::contains($row['name'], $monsterOnly))
                ->values();
        }

        $this->info("対象モンスター数: " . $monsterLinks->count());

        $rows = collect();
        $skipped = 0;

        foreach ($monsterLinks as $monsterLink) {
            $monsterName = $monsterLink['name'];
            $monsterUrl = $monsterLink['url'];
            $listPage = $monsterLink['list_page'] ?? null;

            $this->newLine();
            $this->line("---- モンスター処理開始: {$monsterName}");
            $this->line("URL: {$monsterUrl}");

            try {
                $html = $this->fetchHtml($monsterUrl);
                $spawns = $this->extractSpawnRowsFromMonsterPage($html);

                if ($spawns->isEmpty()) {
                    $this->warn("[SKIP] 出現テーブルなし: {$monsterName}");
                    $skipped++;
                    continue;
                }

                foreach ($spawns as $spawn) {
                    $rows->push([
                        'list_page'    => $listPage,
                        'monster_name' => $monsterName,
                        'monster_url'  => $monsterUrl,
                        'section'      => $spawn['section'],
                        'map_name'     => $spawn['map_name'],
                        'note'         => $spawn['note'],
                        'version'      => $spawn['version'],
                        'spawn_time'   => $spawn['spawn_time'] ?: 'normal',
                        'spawn_count'  => $spawn['spawn_count'],
                        'symbol_count' => $spawn['symbol_count'],
                    ]);
                }

                $this->info("[OK] {$monsterName} / " . $spawns->count() . " rows");
            } catch (Throwable $e) {
                $this->error("[ERROR] {$monsterName}: {$e->getMessage()}");
                $skipped++;
            }
        }

        $path = $this->writeCsv($rows, $output);

        $this->newLine();
        $this->info("完了 rows={$rows->count()} skipped={$skipped}");
        $this->info("CSV: {$path}");

        return self::SUCCESS;
    }

    protected function resolvePages(): Collection
    {
        if ((bool) $this->option('all-pages')) {
            return collect(range(1, $this->maxPage));
        }

        $raw = trim((string) $this->option('pages', ''));

        if ($raw === '') {
            return collect();
        }

        return collect(explode(',', $raw))
            ->map(fn ($v) => trim($v))
            ->filter(fn ($v) => $v !== '')
            ->map(fn ($v) => (int) $v)
            ->filter(fn ($v) => $v > 0)
            ->unique()
            ->values();
    }

    protected function buildListPageUrl(int $pageNo): string
    {
        return $this->baseUrl . '/wiki/' . rawurlencode($pageNo . 'ページ目');
    }

    protected function fetchHtml(string $url): string
    {
        $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
                'Referer' => $this->baseUrl . '/',
            ])
            ->timeout(30)
            ->retry(2, 1000)
            ->get($url);

        $response->throw();

        $html = $response->body();

        if ($html === '') {
            throw new \RuntimeException("HTML取得失敗: {$url}");
        }

        return $html;
    }

    protected function extractMonsterLinksFromListPage(string $html, int $pageNo): Collection
    {
        $crawler = new Crawler($html, $this->baseUrl);
        $links = collect();

        // 一覧の表だけを見る
        $crawler->filter('tbody tr')->each(function (Crawler $tr) use (&$links, $pageNo) {
            $tds = $tr->filter('td');

            if ($tds->count() === 0) {
                return;
            }

            // 1行に 4列: 格下Lv, モンスター, 格下Lv, モンスター
            // なので 2列目と4列目だけ見ればよい
            foreach ([1, 3] as $index) {
                if (! $tds->eq($index)->count()) {
                    continue;
                }

                $anchor = $tds->eq($index)->filter('a[href*="/wiki/"]');

                if ($anchor->count() === 0) {
                    continue;
                }

                $name = trim($this->normalizeText($anchor->text('', false)));
                $href = $anchor->attr('href');

                if ($name === '' || ! $href) {
                    continue;
                }

                $links->push([
                    'list_page' => $pageNo,
                    'name'      => $name,
                    'url'       => $this->absoluteUrl($href),
                ]);
            }
        });

        return $links
            ->unique('url')
            ->values();
    }

    protected function extractSpawnRowsFromMonsterPage(string $html): Collection
    {
        $crawler = new Crawler($html, $this->baseUrl);

        $rows = collect();
        $currentSection = null;

        $crawler->filter('tr')->each(function (Crawler $tr) use (&$rows, &$currentSection) {
            $tds = $tr->filter('td');

            if ($tds->count() === 0) {
                return;
            }

            if ($tds->count() === 1) {
                $heading = trim($this->normalizeText($tds->eq(0)->text('', false)));

                if (in_array($heading, ['フィールド', 'コンテンツエリア'], true)) {
                    $currentSection = $heading;
                }

                return;
            }

            if (! in_array($currentSection, ['フィールド', 'コンテンツエリア'], true)) {
                return;
            }

            if ($tds->count() < 3) {
                return;
            }

            $mapName = trim($this->normalizeText($tds->eq(0)->text('', false)));
            $desc = trim($this->normalizeText($tds->eq(1)->text('', false)));
            $version = trim($this->normalizeText($tds->eq(2)->text('', false)));

            if ($mapName === '') {
                return;
            }

            [$spawnTime, $spawnCount, $symbolCount] = $this->parseSpawnMeta($desc);

            $rows->push([
                'section'      => $currentSection,
                'map_name'     => $mapName,
                'note'         => $desc,
                'version'      => $version,
                'spawn_time'   => $spawnTime,
                'spawn_count'  => $spawnCount,
                'symbol_count' => $symbolCount,
            ]);
        });

        return $rows;
    }

    protected function writeCsv(Collection $rows, ?string $output = null): string
    {
        $dir = 'dqx/exports';

        if ($output === null || trim($output) === '') {
            $output = $dir . '/monster_map_notes_' . now()->format('Ymd_His') . '.csv';
        }

        Storage::makeDirectory(dirname($output));

        $stream = fopen('php://temp', 'r+');

        fputcsv($stream, [
            'list_page',
            'monster_name',
            'monster_url',
            'section',
            'map_name',
            'note',
            'version',
            'spawn_time',
            'spawn_count',
            'symbol_count',
        ]);

        foreach ($rows as $row) {
            fputcsv($stream, [
                $row['list_page'] ?? null,
                $row['monster_name'] ?? null,
                $row['monster_url'] ?? null,
                $row['section'] ?? null,
                $row['map_name'] ?? null,
                $row['note'] ?? null,
                $row['version'] ?? null,
                $row['spawn_time'] ?? null,
                $row['spawn_count'] ?? null,
                $row['symbol_count'] ?? null,
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        Storage::put($output, $csv);

        return storage_path('app/' . $output);
    }

    protected function normalizeText(?string $text): string
    {
        $text = html_entity_decode((string) $text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace("\xc2\xa0", ' ', $text);
        $text = str_replace('　', ' ', $text);
        $text = preg_replace('/\s+/u', ' ', $text);

        return trim($text);
    }

    protected function absoluteUrl(string $href): string
    {
        if (Str::startsWith($href, ['http://', 'https://'])) {
            return $href;
        }

        return rtrim($this->baseUrl, '/') . '/' . ltrim($href, '/');
    }

    protected function parseSpawnMeta(string $text): array
    {
        $text = $this->normalizeText($text);

        $spawnTime = 'normal';
        if (preg_match('/夜のみ/u', $text)) {
            $spawnTime = 'night';
        } elseif (preg_match('/昼のみ/u', $text)) {
            $spawnTime = 'day';
        }

        $spawnCount = null;
        $symbolCount = null;

        if (preg_match('/([0-9一二三四五六七八九十]+(?:\s*[〜～\-]\s*[0-9一二三四五六七八九十]+)?)匹構成/u', $text, $m)) {
            $spawnCount = $this->kanjiNumbersToArabic($m[1]);
        } elseif (preg_match('/多数/u', $text)) {
            $spawnCount = '多数';
        }

        if (preg_match('/シンボルが?([0-9一二三四五六七八九十]+(?:\s*[〜～\-]\s*[0-9一二三四五六七八九十]+)?)個/u', $text, $m)) {
            $symbolCount = $this->kanjiNumbersToArabic($m[1]);
        } elseif (preg_match('/シンボルの数はそんなに多くない/u', $text)) {
            $symbolCount = '少なめ';
        }

        return [$spawnTime, $spawnCount, $symbolCount];
    }

    protected function kanjiNumbersToArabic(string $text): string
    {
        $map = [
            '一' => '1',
            '二' => '2',
            '三' => '3',
            '四' => '4',
            '五' => '5',
            '六' => '6',
            '七' => '7',
            '八' => '8',
            '九' => '9',
            '十' => '10',
        ];

        return strtr($text, $map);
    }
}