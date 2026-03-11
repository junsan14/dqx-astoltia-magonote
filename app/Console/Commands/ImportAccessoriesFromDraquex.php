<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ImportAccessoriesFromDraquex extends Command
{
    protected $signature = 'dq10:import-accessories-draquex
                            {--fresh : accessories を空にして id を1から入れ直す}
                            {--limit= : 詳細ページの先頭n件だけ試す}
                            {--category= : kao,kubi,yubi,mune,kosi,fuda,hoka,monsyou,akasi,kokoro のどれか1つ}';

    protected $description = 'Import accessories from draquex';

    protected string $rootUrl = 'https://draquex.com/akuse/';

    protected array $categories = [
        'kao'      => ['url' => 'https://draquex.com/akuse/0-kao.php', 'slot' => '顔アクセサリー', 'type' => '顔'],
        'kubi'     => ['url' => 'https://draquex.com/akuse/0-kubi.php', 'slot' => '首アクセサリー', 'type' => '首'],
        'yubi'     => ['url' => 'https://draquex.com/akuse/0-yubi.php', 'slot' => '指アクセサリー', 'type' => '指'],
        'mune'     => ['url' => 'https://draquex.com/akuse/0-mune.php', 'slot' => '胸アクセサリー', 'type' => '胸'],
        'kosi'     => ['url' => 'https://draquex.com/akuse/0-kosi.php', 'slot' => '腰アクセサリー', 'type' => '腰'],
        'fuda'     => ['url' => 'https://draquex.com/akuse/0-fuda.php', 'slot' => '札アクセサリー', 'type' => '札'],
        'hoka'     => ['url' => 'https://draquex.com/akuse/0-hoka.php', 'slot' => '他アクセサリー', 'type' => '他'],
        'monsyou'  => ['url' => 'https://draquex.com/akuse/0-monsyou.php', 'slot' => '紋章', 'type' => '紋章'],
        'akasi'    => ['url' => 'https://draquex.com/akuse/0-akasi.php', 'slot' => '職業の証', 'type' => '証'],
        'kokoro'   => ['url' => 'https://draquex.com/akuse/0-kokoro.php', 'slot' => 'こころ', 'type' => 'こころ'],
    ];

    public function handle(): int
    {
        if ($this->option('fresh')) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            DB::table('accessories')->truncate();
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
            $this->warn('truncate accessories: id reset to 1');
        }

        $targets = $this->resolveTargets();
        if (empty($targets)) {
            $this->error('category が不正');
            return self::FAILURE;
        }

        $limit = (int) $this->option('limit');
        $savedCount = 0;

        foreach ($targets as $key => $category) {
            $this->info("fetch category: {$category['url']}");

            $html = $this->fetch($category['url']);
            if (!$html) {
                $this->warn("failed category: {$category['url']}");
                continue;
            }

            $items = $this->parseAccessoryList($html, $category['url'], $category['slot'], $category['type']);

            $this->info("found: " . count($items));

            foreach ($items as $index => $item) {
                if ($limit > 0 && $savedCount >= $limit) {
                    $this->info('limit reached');
                    return self::SUCCESS;
                }

                $this->line(sprintf('[%d/%d] %s', $index + 1, count($items), $item['name']));

                $detailHtml = $this->fetch($item['detail_url']);

                $detail = [
                    'equip_level' => $item['equip_level'],
                    'description' => null,
                    'effects' => [],
                    'synthesis_effects' => [],
                    'obtain_methods' => [],
                    'image_url' => $item['image_url'],
                ];

                if (!$detailHtml) {
                    $this->warn("failed detail: {$item['detail_url']} (一覧情報だけ保存する)");
                } else {
                    try {
                        $detail = $this->parseAccessoryDetail($detailHtml, $item);
                    } catch (\Throwable $e) {
                        $this->warn("parse detail failed: {$item['detail_url']} / {$e->getMessage()}");
                    }
                }

                $existing = DB::table('accessories')
                    ->where('detail_url', $item['detail_url'])
                    ->first();

                $itemId = $existing?->item_id
                    ?: $this->buildAccessoryItemId($key);

                $payload = [
                    'item_id'                => $itemId,
                    'name'                   => $item['name'],
                    'item_kind'              => 'accessory',
                    'slot'                   => $item['slot'],
                    'accessory_type'         => $item['accessory_type'],
                    'equip_level'            => $detail['equip_level'] ?? $item['equip_level'],
                    'description'            => $detail['description'],
                    'effects_json'           => $this->toJsonOrNull($detail['effects']),
                    'synthesis_effects_json' => $this->toJsonOrNull($detail['synthesis_effects']),
                    'obtain_methods_json'    => $this->toJsonOrNull($detail['obtain_methods']),
                    'image_url'              => $detail['image_url'] ?? $item['image_url'],
                    'source_url'             => $category['url'],
                    'detail_url'             => $item['detail_url'],
                    'updated_at'             => now(),
                ];

                if ($existing) {
                    DB::table('accessories')
                        ->where('detail_url', $item['detail_url'])
                        ->update($payload);

                    $this->info("updated: {$item['name']} ({$itemId})");
                } else {
                    $payload['created_at'] = now();
                    DB::table('accessories')->insert($payload);

                    $this->info("inserted: {$item['name']} ({$itemId})");
                }

                $savedCount++;
                usleep(150000);
            }
        }

        $this->info('done');
        return self::SUCCESS;
    }

    private function resolveTargets(): array
    {
        $category = trim((string) $this->option('category'));

        if ($category === '') {
            return $this->categories;
        }

        if (!isset($this->categories[$category])) {
            return [];
        }

        return [
            $category => $this->categories[$category],
        ];
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

    private function parseAccessoryList(string $html, string $baseUrl, string $slot, string $accessoryType): array
    {
        libxml_use_internal_errors(true);

        $dom = new \DOMDocument();
        $dom->loadHTML('<?xml encoding="UTF-8">' . mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
        $xpath = new \DOMXPath($dom);

        $nodes = $xpath->query('//section[contains(@class,"item")]//ul/li/a[contains(@class,"arrow")] | //ul/li/a[contains(@class,"arrow")]');

        $items = [];

        foreach ($nodes as $a) {
            $href = trim((string) $a->getAttribute('href'));
            if ($href === '') {
                continue;
            }

            $nameNode = $xpath->query('.//p[contains(@class,"name")]', $a)->item(0);
            if (!$nameNode) {
                continue;
            }

            $nameText = trim(preg_replace('/\s+/u', ' ', $nameNode->textContent));
            $nameText = $this->cleanAccessoryName($nameText);

            if ($nameText === '' || str_contains($nameText, 'アクセサリー') || $nameText === '紋章' || $nameText === '職業の証' || $nameText === 'こころ') {
                continue;
            }

            $imgNode = $xpath->query('.//img', $a)->item(0);
            $imgSrc = $imgNode ? trim((string) $imgNode->getAttribute('src')) : null;
            $imageUrl = $imgSrc ? $this->absoluteUrl($baseUrl, $imgSrc) : null;

            $rawText = trim(preg_replace('/\s+/u', ' ', $a->textContent));
            $equipLevel = null;
            if (preg_match('/Lv\s*([0-9]+)/u', $rawText, $m)) {
                $equipLevel = (int) $m[1];
            }

            $items[] = [
                'name' => $nameText,
                'slot' => $slot,
                'accessory_type' => $accessoryType,
                'equip_level' => $equipLevel,
                'detail_url' => $this->absoluteUrl($baseUrl, $href),
                'image_url' => $imageUrl,
            ];
        }

        $unique = [];
        $seen = [];

        foreach ($items as $item) {
            if (isset($seen[$item['detail_url']])) {
                continue;
            }
            $seen[$item['detail_url']] = true;
            $unique[] = $item;
        }

        return $unique;
    }

    private function parseAccessoryDetail(string $html, array $item): array
    {
        libxml_use_internal_errors(true);

        $result = [
            'equip_level' => $item['equip_level'],
            'description' => null,
            'effects' => [],
            'synthesis_effects' => [],
            'obtain_methods' => [],
            'image_url' => $item['image_url'],
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

            if ($thText === '装備可能レベル') {
                $tdText = trim(preg_replace('/\s+/u', ' ', $tdNode->textContent));
                if (preg_match('/Lv\s*([0-9]+)/u', $tdText, $m)) {
                    $result['equip_level'] = (int) $m[1];
                }
                continue;
            }

            if ($thText === '基礎効果') {
                $result['effects'] = $this->extractLinesFromTd($tdNode);
                continue;
            }

            if (str_contains($thText, '合成で付く効果')) {
                $result['synthesis_effects'] = $this->extractLinesFromTd($tdNode);
                continue;
            }

            if ($thText === '入手方法') {
                $result['obtain_methods'] = $this->extractLinesFromTd($tdNode);
                continue;
            }

            if ($this->isDescriptionRow($thNode, $tdNode)) {
                $result['description'] = $this->cleanAccessoryDescription($tdNode);
                $imgNode = $xpath->query('.//img', $thNode)->item(0);
                if ($imgNode) {
                    $imgSrc = trim((string) $imgNode->getAttribute('src'));
                    if ($imgSrc !== '') {
                        $result['image_url'] = $this->absoluteUrl($item['detail_url'], $imgSrc);
                    }
                }
                continue;
            }
        }

        $result['effects'] = array_values(array_unique(array_filter($result['effects'])));
        $result['synthesis_effects'] = array_values(array_unique(array_filter($result['synthesis_effects'])));
        $result['obtain_methods'] = array_values(array_unique(array_filter($result['obtain_methods'])));

        return $result;
    }

    private function isDescriptionRow(\DOMNode $thNode, \DOMNode $tdNode): bool
    {
        $thHtml = $thNode->ownerDocument->saveHTML($thNode);
        $tdText = trim(preg_replace('/\s+/u', ' ', $tdNode->textContent));

        return stripos($thHtml, '<img') !== false && $tdText !== '';
    }

    private function cleanAccessoryDescription(\DOMNode $tdNode): ?string
    {
        $lines = $this->extractLinesFromTd($tdNode);

        $lines = array_map(function ($line) {
            $line = preg_replace('/^【[^】]+】$/u', '', trim($line));
            return trim($line);
        }, $lines);

        $lines = array_values(array_filter($lines));

        if (empty($lines)) {
            return null;
        }

        return implode(' ', $lines);
    }

    private function cleanAccessoryName(string $text): string
    {
        $text = trim($text);

        $text = preg_replace('/Lv\s*[0-9]+\s*/u', '', $text);

        $text = preg_replace('/\s*[\(（][^\)）]*[\)）]\s*$/u', '', $text);

        $text = preg_replace('/\s+/u', ' ', $text);

        return trim($text);
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

    private function buildAccessoryItemId(string $categoryKey): string
    {
        $prefixMap = [
            'kao' => 'accessory_kao',
            'kubi' => 'accessory_kubi',
            'yubi' => 'accessory_yubi',
            'mune' => 'accessory_mune',
            'kosi' => 'accessory_koshi',
            'fuda' => 'accessory_fuda',
            'hoka' => 'accessory_hoka',
            'monsyou' => 'accessory_monsyou',
            'akasi' => 'accessory_akasi',
            'kokoro' => 'accessory_kokoro',
        ];

        $prefix = $prefixMap[$categoryKey] ?? 'accessory_other';

        $latest = DB::table('accessories')
            ->where('item_id', 'like', $prefix . '_%')
            ->orderByDesc('id')
            ->value('item_id');

        $nextNumber = 1;

        if ($latest && preg_match('/_(\d+)$/', $latest, $m)) {
            $nextNumber = ((int) $m[1]) + 1;
        }

        return $prefix . '_' . $nextNumber;
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

    private function toJsonOrNull($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE);
    }
}