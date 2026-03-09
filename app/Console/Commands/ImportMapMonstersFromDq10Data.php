<?php

namespace App\Console\Commands;

use App\Models\Map;
use App\Models\Monster;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImportMapMonstersFromDq10Data extends Command
{
    protected $signature = 'dq10:import-map-monsters
                            {--list-url=http://www.dq10data.com/map.html}
                            {--dry-run : DB更新せずログだけ出す}';

    protected $description = 'dq10data のマップ一覧から各マップページを巡回し、分布図画像を保存し、モンスター一覧を抽出する';

    protected $mapsByNormalizedName;
    protected $monstersByNormalizedName;

    public function handle(): int
    {
        $this->mapsByNormalizedName = Map::query()
            ->get()
            ->keyBy(fn (Map $map) => $this->normalizeName($map->name));

        $this->monstersByNormalizedName = Monster::query()
            ->get()
            ->keyBy(fn (Monster $monster) => $this->normalizeName($monster->name));

        $listUrl = $this->option('list-url');

        $this->info("一覧ページ取得: {$listUrl}");
        $listHtml = $this->fetchHtml($listUrl);

        if (!$listHtml) {
            $this->error('一覧ページの取得に失敗');
            return self::FAILURE;
        }

        $mapUrls = $this->extractMapUrls($listHtml, $listUrl);

        if (empty($mapUrls)) {
            $this->error('マップURLを抽出できなかった');
            return self::FAILURE;
        }

        $this->info('抽出URL数: ' . count($mapUrls));

        $notFoundMaps = 0;
        $notFoundMonsters = 0;
        $missingMonsters = [];
        $savedImages = [];

        foreach ($mapUrls as $url) {
            $this->newLine();
            $this->line("処理中: {$url}");

            $html = $this->fetchHtml($url);

            if (!$html) {
                $this->warn("取得失敗: {$url}");
                continue;
            }

            [$dom, $xpath] = $this->makeXPath($html);

            $h1 = $this->extractH1FromXPath($xpath);

            if (!$h1) {
                $this->warn("h1 が見つからない: {$url}");
                continue;
            }

            $map = $this->findMapByTitle($h1);

            if (!$map) {
                $notFoundMaps++;
                $this->warn("maps に未登録: [{$h1}]");
                continue;
            }

            $this->info("MAP一致: {$map->name} (#{$map->id})");

            $monsterNames = $this->extractAllMonsterNamesFromPage($xpath);

            if (empty($monsterNames)) {
                $this->line("モンスター記載なし: {$map->name}");

                if (!$this->option('dry-run')) {
                    if ($map->map_type !== 'town') {
                        $map->map_type = 'town';
                        $map->save();
                    }
                }

                $this->info("map_type=town");
            } else {
                if (!$this->option('dry-run')) {
                    if ($map->map_type !== 'field') {
                        $map->map_type = 'field';
                        $map->save();
                    }
                }

                $this->info("map_type=field");
            }

            // 画像保存
            $imageUrl = $this->extractMainMapImageUrl($xpath, $url);

            if ($imageUrl) {
                $safeMapName = preg_replace('/[^\p{L}\p{N}_-]+/u', '_', $map->name);
                $localImagePath = $this->downloadImage(
                    $imageUrl,
                    'map_' . $map->id . '_' . $safeMapName
                );

                if ($localImagePath) {
                    $this->line("画像保存: {$localImagePath}");

                    $size = @getimagesize($localImagePath);
                    $imageWidth = $size[0] ?? 0;
                    $imageHeight = $size[1] ?? 0;

                    $this->line("画像サイズ: {$imageWidth} x {$imageHeight}");

                    $savedImages[] = [
                        'map_id' => $map->id,
                        'map_name' => $map->name,
                        'page_url' => $url,
                        'image_url' => $imageUrl,
                        'saved_path' => $localImagePath,
                        'width' => $imageWidth,
                        'height' => $imageHeight,
                    ];
                } else {
                    $this->warn("画像保存失敗: {$imageUrl}");
                }
            } else {
                $this->warn("分布図画像URLが見つからない");
            }

            foreach ($monsterNames as $monsterName) {
                $monster = $this->findMonsterByName($monsterName);

                if (!$monster) {
                    $notFoundMonsters++;
                    $this->warn("monsters に未登録: [{$monsterName}]");

                    $missingMonsters[] = [
                        'monster_name' => $monsterName,
                        'normalized_name' => $this->normalizeName($monsterName),
                        'map_name' => $map->name,
                        'page_url' => $url,
                    ];
                } else {
                    $this->line("monster一致: {$monster->name}");
                }
            }
        }

        $missingMonsters = collect($missingMonsters)
            ->unique(function ($row) {
                return implode('|', [
                    $row['normalized_name'],
                    $row['map_name'],
                ]);
            })
            ->values()
            ->all();

        if (!empty($missingMonsters)) {
            Storage::disk('local')->put(
                'dq10/missing_monsters.json',
                json_encode($missingMonsters, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            );

            $missingMonsterNames = collect($missingMonsters)
                ->pluck('monster_name')
                ->unique()
                ->values()
                ->all();

            Storage::disk('local')->put(
                'dq10/missing_monster_names.json',
                json_encode($missingMonsterNames, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            );

            $this->info('未登録モンスターJSON出力: storage/app/dq10/missing_monsters.json');
            $this->info('未登録モンスター名JSON出力: storage/app/dq10/missing_monster_names.json');
        }

        if (!empty($savedImages)) {
            Storage::disk('local')->put(
                'dq10/saved_map_images.json',
                json_encode($savedImages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            );

            $this->info('保存画像JSON出力: storage/app/dq10/saved_map_images.json');
        }

        $this->newLine();
        $this->info("完了 maps未一致={$notFoundMaps}, monsters未一致={$notFoundMonsters}");

        return self::SUCCESS;
    }

    protected function extractMainMapImageUrl(DOMXPath $xpath, string $baseUrl): ?string
    {
        $h2Nodes = $xpath->query('//h2');

        foreach ($h2Nodes as $h2) {
            $title = $this->cleanText($h2->textContent);

            if (!str_contains($title, 'モンスター分布図')) {
                continue;
            }

            $current = $h2;
            $step = 0;

            while ($current && $step < 20) {
                $current = $current->nextSibling;
                $step++;

                if (!$current) {
                    break;
                }

                if ($current->nodeType !== XML_ELEMENT_NODE) {
                    continue;
                }

                if ($current->nodeName === 'img') {
                    $src = trim($current->getAttribute('src'));

                    if ($src !== '') {
                        return $this->toAbsoluteUrl($src, $baseUrl);
                    }
                }

                $img = $xpath->query('.//img[@src]', $current)->item(0);

                if ($img instanceof DOMElement) {
                    $src = trim($img->getAttribute('src'));

                    if ($src !== '') {
                        return $this->toAbsoluteUrl($src, $baseUrl);
                    }
                }

                if (in_array($current->nodeName, ['h1', 'h2'], true)) {
                    break;
                }
            }
        }

        return null;
    }

    protected function downloadImage(string $url, string $filenameBase): ?string
    {
        try {
            $response = Http::timeout(20)
                ->retry(2, 1000)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (compatible; Laravel Scraper)',
                ])
                ->get($url);

            if (!$response->successful()) {
                return null;
            }

            $dir = storage_path('app/dq10/maps');

            if (!is_dir($dir)) {
                mkdir($dir, 0777, true);
            }

            $pathPart = parse_url($url, PHP_URL_PATH) ?? '';
            $extension = strtolower(pathinfo($pathPart, PATHINFO_EXTENSION));
            $extension = $extension ?: 'img';

            $fullPath = $dir . '/' . $filenameBase . '.' . $extension;

            file_put_contents($fullPath, $response->body());

            return $fullPath;
        } catch (\Throwable $e) {
            $this->warn("image download error: {$url} / {$e->getMessage()}");
            return null;
        }
    }

    protected function extractAllMonsterNamesFromPage(DOMXPath $xpath): array
    {
        $names = [];

        $tables = $xpath->query('//table');

        foreach ($tables as $table) {
            if (!$table instanceof DOMElement) {
                continue;
            }

            if (!$this->isMonsterTable($table, $xpath)) {
                continue;
            }

            $rows = $xpath->query('.//tbody/tr', $table);

            foreach ($rows as $tr) {
                $firstTd = $xpath->query('./td[1]', $tr)->item(0);

                if (!$firstTd) {
                    continue;
                }

                $monsterName = $this->cleanText($firstTd->textContent);

                if ($monsterName !== '') {
                    $names[] = $monsterName;
                }
            }
        }

        return array_values(array_unique($names));
    }

    protected function isMonsterTable(DOMElement $table, DOMXPath $xpath): bool
    {
        $ths = $xpath->query('.//thead//th', $table);

        foreach ($ths as $th) {
            $text = $this->cleanText($th->textContent);

            if ($text === 'モンスター名') {
                return true;
            }
        }

        return false;
    }

    protected function extractH1FromXPath(DOMXPath $xpath): ?string
    {
        $node = $xpath->query('//h1')->item(0);

        if (!$node) {
            return null;
        }

        return $this->cleanText($node->textContent);
    }

    protected function extractMapUrls(string $html, string $baseUrl): array
    {
        [$dom, $xpath] = $this->makeXPath($html);

        $urls = [];

        foreach ($xpath->query('//a[@href]') as $a) {
            $href = trim($a->getAttribute('href'));

            if ($href === '') {
                continue;
            }

            $absolute = $this->toAbsoluteUrl($href, $baseUrl);

            if (!$absolute) {
                continue;
            }

            if (Str::endsWith($absolute, '/map.html')) {
                continue;
            }

            if (!Str::contains($absolute, 'dq10data.com')) {
                continue;
            }

            if (!preg_match('/\.html?$/i', $absolute)) {
                continue;
            }

            $urls[] = $absolute;
        }

        return array_values(array_unique($urls));
    }

    protected function fetchHtml(string $url): ?string
    {
        try {
            $response = Http::timeout(20)
                ->retry(2, 1000)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (compatible; Laravel Scraper)',
                    'Accept-Language' => 'ja,en;q=0.8',
                ])
                ->get($url);

            if (!$response->successful()) {
                return null;
            }

            $html = $response->body();

            return mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8, SJIS-win, SJIS, EUC-JP, JIS, ASCII');
        } catch (\Throwable $e) {
            $this->warn("fetch error: {$url} / {$e->getMessage()}");
            return null;
        }
    }

    protected function findMapByTitle(string $title): ?Map
    {
        $normalized = $this->normalizeName($title);

        if ($this->mapsByNormalizedName->has($normalized)) {
            return $this->mapsByNormalizedName->get($normalized);
        }

        $normalized = str_replace(['マップ', 'MAP'], '', $normalized);

        return $this->mapsByNormalizedName->get($normalized);
    }

    protected function findMonsterByName(string $name): ?Monster
    {
        $normalized = $this->normalizeName($name);

        return $this->monstersByNormalizedName->get($normalized);
    }

    protected function normalizeName(?string $text): string
    {
        $text = $text ?? '';
        $text = $this->cleanText($text);
        $text = mb_convert_kana($text, 'asKV', 'UTF-8');
        $text = preg_replace('/\s+/u', '', $text);
        $text = str_replace(['　', '・'], '', $text);

        return trim($text);
    }

    protected function cleanText(?string $text): string
    {
        $text = $text ?? '';
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/u', ' ', $text);

        return trim($text);
    }

    protected function toAbsoluteUrl(string $href, string $baseUrl): ?string
    {
        if (Str::startsWith($href, ['http://', 'https://'])) {
            return $href;
        }

        if (Str::startsWith($href, '//')) {
            return 'http:' . $href;
        }

        $base = parse_url($baseUrl);

        if (!$base || empty($base['scheme']) || empty($base['host'])) {
            return null;
        }

        $scheme = $base['scheme'];
        $host = $base['host'];

        if (Str::startsWith($href, '/')) {
            return "{$scheme}://{$host}{$href}";
        }

        $path = $base['path'] ?? '/';
        $dir = rtrim(str_replace('\\', '/', dirname($path)), '/');
        $dir = $dir === '.' ? '' : $dir;

        return "{$scheme}://{$host}{$dir}/{$href}";
    }

    protected function makeXPath(string $html): array
    {
        libxml_use_internal_errors(true);

        $dom = new DOMDocument();
        $dom->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);

        libxml_clear_errors();

        return [$dom, new DOMXPath($dom)];
    }
}