<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ImportEquipmentsFromDraquex extends Command
{
    protected $signature = 'dq10:import-equipments-draquex
                            {--type= : katate, taiken, tanken など1種だけ実行}
                            {--url= : 一覧URLを直接指定}
                            {--fresh : 対象データを削除して入れ直す}';

    protected $description = 'Import equipments from draquex list/detail pages';

    protected array $urls = [
        'katate' => ['url' => 'https://draquex.com/buki/0-katate.php', 'type' => '片手剣'],
        'taiken' => ['url' => 'https://draquex.com/buki/0-taiken.php', 'type' => '両手剣'],
        'tanken' => ['url' => 'https://draquex.com/buki/0-tanken.php', 'type' => '短剣'],
        'yari'   => ['url' => 'https://draquex.com/buki/0-yari.php',   'type' => 'ヤリ'],
        'ono'    => ['url' => 'https://draquex.com/buki/0-ono.php',    'type' => 'オノ'],
        'hanma'  => ['url' => 'https://draquex.com/buki/0-hanma.php',  'type' => 'ハンマー'],
        'tsume'  => ['url' => 'https://draquex.com/buki/0-tsume.php',  'type' => 'ツメ'],
        'muchi'  => ['url' => 'https://draquex.com/buki/0-muchi.php',  'type' => 'ムチ'],
        'bume'   => ['url' => 'https://draquex.com/buki/0-bume.php',   'type' => 'ブーメラン'],
        'sti'    => ['url' => 'https://draquex.com/buki/0-sti.php',    'type' => 'スティック'],
        'tsue'   => ['url' => 'https://draquex.com/buki/0-tsue.php',   'type' => '両手杖'],
        'kon'    => ['url' => 'https://draquex.com/buki/0-kon.php',    'type' => '棍'],
        'ougi'   => ['url' => 'https://draquex.com/buki/0-ougi.php',   'type' => '扇'],
        'yumi'   => ['url' => 'https://draquex.com/buki/0-yumi.php',   'type' => '弓'],
        'kama'   => ['url' => 'https://draquex.com/buki/0-kama.php',   'type' => '鎌'],
        'tate'   => ['url' => 'https://draquex.com/buki/0-tate.php',   'type' => '盾'],
    ];

    public function handle(): int
    {
        $targets = $this->resolveTargets();

        if (empty($targets)) {
            $this->error('対象が見つからない');
            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->deleteTargetRows($targets);
        }

        foreach ($targets as $key => $target) {
            $listUrl = $target['url'];
            $itemType = $target['type'];

            $this->info("fetch list: {$listUrl}");

            $html = $this->fetch($listUrl);
            if (!$html) {
                $this->error("failed list: {$listUrl}");
                continue;
            }

            $items = $this->parseList($html, $listUrl, $itemType);

            $this->info("found: " . count($items));

            foreach ($items as $index => $item) {
                $this->line(sprintf(
                    '[%d/%d] Lv%s %s',
                    $index + 1,
                    count($items),
                    $item['equip_level'] ?? '-',
                    $item['item_name']
                ));

                $detailHtml = $this->fetch($item['detail_url']);
                if (!$detailHtml) {
                    $this->warn("failed detail: {$item['detail_url']}");
                    continue;
                }

                $detail = $this->parseDetail($detailHtml, $itemType);

                $payload = [
                    'item_id'            => md5($item['detail_url']),
                    'item_name'          => $item['item_name'],
                    'item_kind'          => $itemType === '盾' ? '盾' : '武器',
                    'item_type_key'      => $key,
                    'item_type'          => $itemType,
                    'craft_type'         => $itemType === '盾' ? '防具鍛冶' : '武器鍛冶',
                    'craft_level'        => $detail['craft_level'],
                    'equip_level'        => $detail['equip_level'] ?? $item['equip_level'],
                    'recipe_book'        => $detail['recipe_book'],
                    'recipe_place'       => $detail['recipe_place'],
                    'description'        => $detail['description'],
                    'effect'             => $detail['effect'],
                    'slot'               => $itemType,
                    'slot_grid_type'     => null,
                    'slot_grid_cols'     => null,
                    'group_kind'         => $itemType === '盾' ? 'shield' : 'weapon',
                    'group_id'           => null,
                    'group_name'         => $itemType,
                    'items_count'        => null,
                    'crystal_by_alchemy' => null,
                    'materials_json'     => $this->toJsonOrNull($detail['materials']),
                    'slot_grid_json'     => null,
                    'jobs_json'          => $this->toJsonOrNull($detail['jobs']),
                    'equipable_type'     => $itemType,
                    'source_url'         => $listUrl,
                    'detail_url'         => $item['detail_url'],
                    'effects_json'       => $this->toJsonOrNull($detail['effects']),
                    'stats_json'         => $this->toJsonOrNull($detail['stats']),
                    'artisan_level_text' => $detail['artisan_level_text'],
                    'updated_at'         => now(),
                ];

                $exists = DB::table('equipments')
                    ->where('detail_url', $item['detail_url'])
                    ->exists();

                if ($exists) {
                    DB::table('equipments')
                        ->where('detail_url', $item['detail_url'])
                        ->update($payload);

                    $this->info("updated: {$item['item_name']}");
                } else {
                    $payload['created_at'] = now();
                    DB::table('equipments')->insert($payload);
                    $this->info("inserted: {$item['item_name']}");
                }

                usleep(200000);
            }
        }

        $this->info('done');
        return self::SUCCESS;
    }

    private function resolveTargets(): array
    {
        $type = trim((string) $this->option('type'));
        $url = trim((string) $this->option('url'));

        if ($url !== '') {
            $key = $this->guessTypeKeyFromUrl($url);
            return [
                $key => [
                    'url' => $url,
                    'type' => $this->urls[$key]['type'] ?? '武器',
                ]
            ];
        }

        if ($type !== '') {
            if (!isset($this->urls[$type])) {
                $this->error("unknown type: {$type}");
                return [];
            }

            return [
                $type => $this->urls[$type],
            ];
        }

        return $this->urls;
    }

    private function deleteTargetRows(array $targets): void
    {
        foreach ($targets as $key => $target) {
            $deleted = DB::table('equipments')
                ->where('item_type_key', $key)
                ->delete();

            $this->warn("deleted {$deleted} rows: {$target['type']}");
        }
    }

    private function fetch(string $url): ?string
    {
        try {
            $res = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0',
                'Referer' => 'https://draquex.com/',
            ])->timeout(20)->get($url);

            if (!$res->successful()) {
                return null;
            }

            return $res->body();
        } catch (\Throwable $e) {
            $this->warn($e->getMessage());
            return null;
        }
    }

    private function parseList(string $html, string $baseUrl, string $itemType): array
    {
        libxml_use_internal_errors(true);

        $dom = new \DOMDocument();
        $dom->loadHTML('<?xml encoding="UTF-8">' . mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));

        $xpath = new \DOMXPath($dom);
        $nodes = $xpath->query('//section[contains(@class,"item")]//ul/li/a[contains(@class,"arrow")]');

        $items = [];

        foreach ($nodes as $a) {
            $href = trim((string) $a->getAttribute('href'));
            if ($href === '') {
                continue;
            }

            $p = $xpath->query('.//p[contains(@class,"name")]', $a)->item(0);
            if (!$p) {
                continue;
            }

            $raw = trim($p->textContent);
            $raw = preg_replace('/\s+/u', ' ', $raw);

            $equipLevel = null;
            $itemName = $raw;

            if (preg_match('/Lv\s*([0-9]+)\s*(.+)$/u', $raw, $m)) {
                $equipLevel = (int) $m[1];
                $itemName = trim($m[2]);
            }

            if ($itemName === '') {
                continue;
            }

            $items[] = [
                'item_name'   => $itemName,
                'equip_level' => $equipLevel,
                'item_type'   => $itemType,
                'detail_url'  => $this->absoluteUrl($baseUrl, $href),
            ];
        }

        return $items;
    }

    private function parseDetail(string $html, string $itemType): array
    {
        libxml_use_internal_errors(true);

        $result = [
            'craft_level' => null,
            'equip_level' => null,
            'recipe_book' => null,
            'recipe_place' => null,
            'artisan_level_text' => null,
            'description' => null,
            'effect' => null,
            'jobs' => [],
            'materials' => [],
            'effects' => [],
            'stats' => [],
        ];

        $dom = new \DOMDocument();
        $dom->loadHTML('<?xml encoding="UTF-8">' . mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
        $xpath = new \DOMXPath($dom);

        $rows = $xpath->query('//tr');

        foreach ($rows as $tr) {
            $thNode = $xpath->query('./th', $tr)->item(0);
            $tdNode = $xpath->query('./td', $tr)->item(0);

            if (!$thNode || !$tdNode) {
                continue;
            }

            $thText = trim(preg_replace('/\s+/u', ' ', $thNode->textContent));
            $tdText = trim(preg_replace('/\s+/u', ' ', $tdNode->textContent));

            if ($thText === '職人レベル') {
                $result['artisan_level_text'] = $tdText;

                if (preg_match('/Lv\s*([0-9]+)/u', $tdText, $m)) {
                    $result['craft_level'] = (int) $m[1];
                }

                continue;
            }

            if ($thText === 'レシピの名前') {
                $result['recipe_book'] = $tdText;
                continue;
            }

            if ($thText === 'レシピの場所') {
                $result['recipe_place'] = $tdText;
                continue;
            }

            if ($thText === '装備可能な職業') {
                $jobs = preg_split('/[･・、,\s]+/u', $tdText);
                $jobs = array_values(array_filter(array_map('trim', $jobs)));
                $result['jobs'] = $jobs;
                continue;
            }

            if ($thText === '装備可能レベル') {
                if (preg_match('/Lv\s*([0-9]+)/u', $tdText, $m)) {
                    $result['equip_level'] = (int) $m[1];
                }
                continue;
            }

            if ($thText === '作る時の素材') {
                $result['materials'] = $this->parseMaterialsFromTd($tdNode);
                continue;
            }

            if ($thText === '武器の効果' || $thText === '盾の効果') {
                $effectLines = $this->extractLinesFromTd($tdNode);
                $effectLines = array_values(array_filter($effectLines));

                $result['effects'] = $effectLines;
                $result['effect'] = implode("\n", $effectLines);
                continue;
            }

            if ($this->isDescriptionRow($thNode, $tdNode, $itemType)) {
                $result['description'] = $this->cleanDescription($tdNode, $itemType);
                continue;
            }

            if (in_array($thText, ['攻撃力', '守備力', 'おしゃれさ', '重さ', 'こうげき魔力', 'かいふく魔力', 'きようさ', 'すばやさ', 'MP吸収率', '盾ガード率'], true)) {
                $num = $this->extractInt($tdText);
                if ($num !== null) {
                    $result['stats'][$thText] = $num;
                }
                continue;
            }

            if (str_contains($thText, '効果') || str_contains($thText, '基礎効果')) {
                if ($tdText !== '') {
                    $result['effects'][] = $tdText;
                }
                continue;
            }
        }

        $result['jobs'] = array_values(array_unique($result['jobs']));
        $result['effects'] = array_values(array_unique(array_filter($result['effects'])));

        if ($result['effect'] === null && !empty($result['effects'])) {
            $result['effect'] = implode("\n", $result['effects']);
        }

        return $result;
    }

    private function isDescriptionRow(\DOMNode $thNode, \DOMNode $tdNode, string $itemType): bool
    {
        $thHtml = $thNode->ownerDocument->saveHTML($thNode);
        $tdText = trim(preg_replace('/\s+/u', ' ', $tdNode->textContent));

        if (stripos($thHtml, '<img') !== false && $tdText !== '') {
            return true;
        }

        return false;
    }

    private function cleanDescription(\DOMNode $tdNode, string $itemType): ?string
    {
        $lines = $this->extractLinesFromTd($tdNode);

        $lines = array_map(function ($line) use ($itemType) {
            $line = trim($line);
            $line = preg_replace('/^【[^】]+】$/u', '', $line);
            $line = str_replace("【{$itemType}】", '', $line);
            return trim($line);
        }, $lines);

        $lines = array_values(array_filter($lines));

        if (empty($lines)) {
            return null;
        }

        return implode("\n", $lines);
    }

    private function extractLinesFromTd(\DOMNode $tdNode): array
    {
        $html = '';
        foreach ($tdNode->childNodes as $child) {
            $html .= $tdNode->ownerDocument->saveHTML($child);
        }

        $html = preg_replace('/<br\s*\/?>/i', "\n", $html);
        $text = strip_tags($html);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $lines = preg_split('/\r\n|\r|\n/u', $text);

        return array_values(array_filter(array_map(function ($line) {
            $line = preg_replace('/\s+/u', ' ', $line);
            return trim($line);
        }, $lines)));
    }

    private function parseMaterialsFromTd(\DOMNode $tdNode): array
    {
        $lines = $this->extractLinesFromTd($tdNode);
        $materials = [];

        foreach ($lines as $line) {
            if (preg_match('/^(.+?)\s*[×xX]\s*(\d+)$/u', $line, $m)) {
                $materials[] = [
                    'name' => trim($m[1]),
                    'count' => (int) $m[2],
                ];
                continue;
            }

            if (preg_match('/^(.+?)[…\.・]+\s*(\d+)個$/u', $line, $m)) {
                $materials[] = [
                    'name' => trim($m[1]),
                    'count' => (int) $m[2],
                ];
                continue;
            }
        }

        return $materials;
    }

    private function extractInt(string $text): ?int
    {
        if (preg_match('/-?\d+/u', $text, $m)) {
            return (int) $m[0];
        }

        return null;
    }

    private function absoluteUrl(string $base, string $href): string
    {
        if (str_starts_with($href, 'http://') || str_starts_with($href, 'https://')) {
            return $href;
        }

        $parts = parse_url($base);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';
        $path = $parts['path'] ?? '/';

        if (str_starts_with($href, '/')) {
            return "{$scheme}://{$host}{$href}";
        }

        $dir = rtrim(dirname($path), '/');
        return "{$scheme}://{$host}{$dir}/" . ltrim($href, '/');
    }

    private function guessTypeKeyFromUrl(string $url): string
    {
        foreach (array_keys($this->urls) as $key) {
            if (str_contains($url, $key)) {
                return $key;
            }
        }

        if (str_contains($url, 'tate')) {
            return 'tate';
        }

        return 'weapon';
    }

    private function toJsonOrNull($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE);
    }
}
