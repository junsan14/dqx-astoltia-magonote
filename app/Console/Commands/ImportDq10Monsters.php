<?php

namespace App\Console\Commands;

use App\Models\Monster;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class ImportDq10Monsters extends Command
{
    protected $signature = 'dq10:import-monsters
                            {--from=1 : Start zukan page number}
                            {--to=8 : End zukan page number}
                            {--limit=0 : Limit monsters per page (0 = no limit)}
                            {--sleep=500 : Sleep milliseconds between detail requests}';

    protected $description = 'Import DQ10 monsters from d-quest-10.com';

    public function handle(): int
    {
        $from = (int) $this->option('from');
        $to = (int) $this->option('to');
        $limit = (int) $this->option('limit');
        $sleepMs = (int) $this->option('sleep');

        if ($from < 1 || $to < $from) {
            $this->error('--from と --to の指定が不正だ');
            return self::FAILURE;
        }

        $allItems = [];

        for ($pageNo = $from; $pageNo <= $to; $pageNo++) {
            $listUrl = $this->buildListUrl($pageNo);
            $this->line("Fetching list page: {$listUrl}");

            $listHtml = $this->fetch($listUrl);

            if (! $listHtml) {
                $this->warn("Failed to fetch list page: {$listUrl}");
                continue;
            }

            $items = $this->extractListItems($listHtml, $listUrl, $pageNo);

            if ($limit > 0) {
                $items = array_slice($items, 0, $limit);
            }

            $this->info("Page {$pageNo}: found " . count($items) . ' monsters.');
            $allItems = array_merge($allItems, $items);
        }

        $allItems = $this->dedupeByDetailUrl($allItems);

        if (count($allItems) === 0) {
            $this->error('No monsters found.');
            return self::FAILURE;
        }

        $this->info('Total monsters to import: ' . count($allItems));

        $bar = $this->output->createProgressBar(count($allItems));
        $bar->start();

        foreach ($allItems as $item) {
            try {
                usleep($sleepMs * 1000);

                $detailHtml = $this->fetch($item['detail_url']);

                $detail = [
                    'system_type' => null,
                    'normal_drop' => $item['normal_drop'],
                    'rare_drop' => $item['rare_drop'],
                    'white_boxes' => [],
                    'locations' => [],
                ];

                if ($detailHtml) {
                    $parsedDetail = $this->parseDetailPage($detailHtml, $item['detail_url']);

                    $detail['system_type'] = $parsedDetail['system_type'];
                    $detail['normal_drop'] = $parsedDetail['normal_drop'] ?: $item['normal_drop'];
                    $detail['rare_drop'] = $parsedDetail['rare_drop'] ?: $item['rare_drop'];
                    $detail['white_boxes'] = $parsedDetail['white_boxes'];
                    $detail['locations'] = $parsedDetail['locations'];
                }

                $monster = Monster::updateOrCreate(
                    ['monster_no' => $item['monster_no']],
                    [
                        'name' => $item['name'],
                        'system_type' => $detail['system_type'],
                        'normal_drop' => $detail['normal_drop'],
                        'rare_drop' => $detail['rare_drop'],
                        'source_url' => $item['detail_url'],
                    ]
                );

                foreach ($detail['white_boxes'] as $whiteBox) {
                    $monster->whiteBoxes()->updateOrCreate(
                        ['item_name' => $whiteBox],
                        ['item_name' => $whiteBox]
                    );
                }

                // locations テーブル/リレーションがあるなら使う
                if (method_exists($monster, 'locations')) {
                    foreach ($detail['locations'] as $location) {
                        $monster->locations()->updateOrCreate(
                            ['location_name' => $location],
                            ['location_name' => $location]
                        );
                    }
                }
            }  catch (\Throwable $e) {
    $this->newLine();
    $this->error("Error on {$item['detail_url']}");
    $this->error(get_class($e));
    $this->line($e->getMessage());
}

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info('Done.');

        return self::SUCCESS;
    }

    private function buildListUrl(int $pageNo): string
    {
        return "https://www.d-quest-10.com/list/o_zukan_{$pageNo}/zukan_1.html";
    }

    private function fetch(string $url): ?string
    {
        try {
            $response = Http::withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
                    'Referer' => 'https://www.d-quest-10.com/',
                ])
                ->timeout(30)
                ->retry(2, 1000)
                ->withOptions([
                    'decode_content' => true,
                ])
                ->get($url);

            if (! $response->successful()) {
                return null;
            }

            $body = $response->body();

            $encoding = mb_detect_encoding($body, ['UTF-8', 'SJIS-win', 'SJIS', 'EUC-JP', 'ISO-2022-JP'], true);
            if ($encoding && $encoding !== 'UTF-8') {
                $body = mb_convert_encoding($body, 'UTF-8', $encoding);
            }

            return $body;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * 一覧ページから monster_no / name / normal_drop / rare_drop / detail_url を取る
     */
    private function extractListItems(string $html, string $baseUrl, int $pageNo): array
    {
        $crawler = new Crawler($html, $baseUrl);

        $items = [];
        $seenDetailUrls = [];

        foreach ($crawler->filter('a[href]') as $a) {
            $node = new Crawler($a, $baseUrl);
            $href = trim((string) $node->attr('href'));
            $name = trim($node->text(''));

            if ($href === '' || $name === '') {
                continue;
            }

            $url = $this->resolveUrl($href, $baseUrl);

            // 詳細ページURL例: /detail/a00151.html
            if (! preg_match('#/detail/[a-z]\d+\.html$#i', $url)) {
                continue;
            }

            if (isset($seenDetailUrls[$url])) {
                continue;
            }

            $seenDetailUrls[$url] = true;

            $blockText = $this->extractNearbyMonsterBlockText($a);
            [$normalDrop, $rareDrop] = $this->extractDropsFromListBlock($blockText);

            $indexInPage = count($items) + 1;
            $monsterNo = (($pageNo - 1) * 100) + $indexInPage;

            $items[] = [
                'monster_no' => $monsterNo,
                'name' => $name,
                'normal_drop' => $normalDrop,
                'rare_drop' => $rareDrop,
                'detail_url' => $url,
            ];
        }

        return $items;
    }

    /**
     * リンク付近のテキストから1モンスター分の塊を作る
     */
    private function extractNearbyMonsterBlockText(\DOMElement $anchor): string
    {
        $text = trim($anchor->textContent ?? '');
        $node = $anchor;
        $limit = 0;

        while ($node && $limit < 20) {
            $node = $node->nextSibling;

            if (! $node) {
                break;
            }

            $chunk = trim($node->textContent ?? '');

            if ($chunk !== '') {
                $text .= ' ' . $chunk;
            }

            $limit++;

            if (str_contains($text, '通常ドロ') && str_contains($text, 'レアドロ')) {
                break;
            }
        }

        return $this->cleanValue($text) ?? '';
    }

    private function extractDropsFromListBlock(string $text): array
    {
        $text = $this->normalizeText($text);
        $text = str_replace("\n", ' ', $text);
        $text = $this->cleanValue($text);

        if (! $text) {
            return [null, null];
        }

        $normalDrop = null;
        $rareDrop = null;

        // 例:
        // スライム 通常ドロ やくそう レアドロ スライムゼリー
        if (preg_match('/通常ドロ\s*(.*?)\s*レアドロ\s*(.+)$/u', $text, $m)) {
            $normalDrop = $this->cleanValue($m[1]);
            $rareDrop = $this->cleanValue($m[2]);
        }

        return [$normalDrop, $rareDrop];
    }

    private function parseDetailPage(string $html, string $url): array
    {
        $crawler = new Crawler($html, $url);
        $bodyText = $this->normalizeText($crawler->filter('body')->text(''));

        [$normalDrop, $rareDrop] = $this->extractDropsFromDetailCrawler($crawler);

        return [
            'system_type' => $this->extractSystemType($bodyText),
            'normal_drop' => $normalDrop,
            'rare_drop' => $rareDrop,
            'white_boxes' => $this->extractWhiteBoxes($bodyText),
            'locations' => $this->extractLocations($bodyText),
        ];
    }

    private function extractDropsFromDetailCrawler(Crawler $crawler): array
    {
        $normalDrop = null;
        $rareDrop = null;

        $crawler->filter('tr')->each(function (Crawler $tr) use (&$normalDrop, &$rareDrop) {
            $tds = $tr->filter('td');

            if ($tds->count() < 4) {
                return;
            }

            $label1 = $this->cleanValue($tds->eq(0)->text(''));
            $value1 = $this->cleanValue($tds->eq(1)->text(''));
            $label2 = $this->cleanValue($tds->eq(2)->text(''));
            $value2 = $this->cleanValue($tds->eq(3)->text(''));

            if ($label1 === '通常ドロ') {
                $normalDrop = $value1;
            }

            if ($label2 === 'レアドロ') {
                $rareDrop = $value2;
            }

            // 念のため逆配置にも対応
            if ($label1 === 'レアドロ') {
                $rareDrop = $value1;
            }

            if ($label2 === '通常ドロ') {
                $normalDrop = $value2;
            }
        });

        return [$normalDrop, $rareDrop];
    }

    private function extractSystemType(string $text): ?string
    {
        // 例: 名称 スライム（系統：スライム系）
        if (preg_match('/系統[：:]\s*([^\)）\n]+)/u', $text, $m)) {
            return $this->cleanValue($m[1]);
        }

        return null;
    }

    private function extractWhiteBoxes(string $text): array
    {
        // 例: 白宝箱 [1]どうのつるぎ [1]ブロンズナイフ [1]ものほしざお
        if (! preg_match('/白宝箱(.*?)生息地/u', $text, $m)) {
            return [];
        }

        $block = $this->cleanValue($m[1]);
        if (! $block) {
            return [];
        }

        $block = preg_replace('/\[\d+\]/u', "\n", $block);
        $parts = array_values(array_filter(array_map([$this, 'cleanValue'], preg_split('/\R+/u', $block))));

        return array_values(array_unique($parts));
    }

    private function extractLocations(string $text): array
    {
        if (! preg_match('/生息地(?:※\d+)?(.*?)(?:注意特技|まめちしき|豆知識|特訓スタンプ|獲得称号|$)/u', $text, $m)) {
            return [];
        }

        $block = $this->cleanValue($m[1]);
        if (! $block) {
            return [];
        }

        $parts = preg_split('/、/u', $block);
        $locations = [];

        foreach ($parts as $part) {
            $part = $this->cleanValue($part);

            if (! $part) {
                continue;
            }

            $part = preg_replace('/（.*?）/u', '', $part);
            $part = preg_replace('/\s*\[.*?\]/u', '', $part);
            $part = $this->cleanValue($part);

            if ($part) {
                $locations[] = $part;
            }
        }

        return array_values(array_unique($locations));
    }

    private function dedupeByDetailUrl(array $items): array
    {
        $result = [];
        $seen = [];

        foreach ($items as $item) {
            $key = $item['detail_url'];

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $result[] = $item;
        }

        return $result;
    }

    private function resolveUrl(string $href, string $baseUrl): string
    {
        if (preg_match('#^https?://#', $href)) {
            return $href;
        }

        $base = parse_url($baseUrl);
        $scheme = $base['scheme'] ?? 'https';
        $host = $base['host'] ?? '';

        if (str_starts_with($href, '/')) {
            return "{$scheme}://{$host}{$href}";
        }

        $path = $base['path'] ?? '/';
        $dir = rtrim(str_replace('\\', '/', dirname($path)), '/');

        return "{$scheme}://{$host}{$dir}/{$href}";
    }

    private function normalizeText(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace("/\t/u", ' ', $text);
        $text = preg_replace("/[ \x{00A0}]+/u", ' ', $text);
        $text = preg_replace("/\n{2,}/u", "\n", $text);

        return trim($text);
    }

    private function cleanValue(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim($value);
        $value = preg_replace('/\s+/u', ' ', $value);

        return $value !== '' ? $value : null;
    }
}