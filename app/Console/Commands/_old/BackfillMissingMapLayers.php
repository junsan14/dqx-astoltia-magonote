<?php

namespace App\Console\Commands;

use App\Models\Map;
use App\Models\MapLayer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\DomCrawler\Crawler;
use Throwable;

class BackfillMissingMapLayers extends Command
{
    protected $signature = 'dq10:backfill-missing-map-layers
        {--only= : マップ名にこの文字列を含むものだけ対象}
        {--limit= : 先頭n件だけ処理}
        {--redownload : 既存画像があっても再ダウンロード}
        {--skip-images : 画像保存しない}
        {--dry-run : DB保存しない}
        {--with-existing : 既存layerありのmapも対象に含める}';

    protected $description = 'maps.source_url をたどって map_layers が無い map の layer を補完する';

    private string $baseUrl = 'https://dq10.i-k-e.net';

    public function handle(): int
    {
        try {
            $query = Map::query()
                ->whereNotNull('source_url')
                ->where('source_url', '!=', '');

            $only = trim((string) $this->option('only'));
            if ($only !== '') {
                $query->where('name', 'like', '%' . $only . '%');
            }

            $limit = (int) $this->option('limit');
            if ($limit > 0) {
                $query->limit($limit);
            }

            $maps = $query->orderBy('id')->get();

            if (!$this->option('with-existing')) {
                $maps = $maps->filter(function (Map $map) {
                    return MapLayer::query()
                        ->where('map_id', $map->id)
                        ->count() === 0;
                })->values();
            }

            $this->info('対象 map 件数: ' . $maps->count());

            $processed = 0;
            $savedCount = 0;
            $skipped = 0;

            foreach ($maps as $index => $map) {
                $this->newLine();
                $this->info(sprintf('[%d/%d] map_id=%d / %s', $index + 1, $maps->count(), $map->id, $map->name));
                $this->line('source_url: ' . $map->source_url);

                try {
                    $html = $this->fetchHtml($map->source_url);

                    if (!$html) {
                        $this->warn('  HTML取得失敗');
                        $skipped++;
                        continue;
                    }

                    $crawler = new Crawler($html, $map->source_url);
                    $layers = $this->extractLayersFromPage($crawler);

                    if (empty($layers)) {
                        $this->warn('  layer候補が見つからない');
                        $skipped++;
                        continue;
                    }

                    $this->line('  抽出layer数: ' . count($layers));

                    if ($this->option('dry-run')) {
                        $this->comment('  dry-run payload');
                        $this->line(json_encode($layers, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
                        $processed++;
                        continue;
                    }

                    foreach ($layers as $layer) {
                        $layerName = $layer['layer_name'] ?? '地上';
                        $floorNo = $this->parseFloorNo($layerName);
                        $imagePath = null;

                        if (
                            !$this->option('skip-images')
                            && !empty($layer['image_url'])
                        ) {
                            $imagePath = $this->downloadImage(
                                imageUrl: $layer['image_url'],
                                mapId: $map->id,
                                continent: (string) $map->continent,
                                floorNo: $floorNo,
                                layerName: $layerName
                            );
                        }

                        $exists = $this->findExistingLayer($map->id, $layerName, $floorNo);

                        $payload = [
                            'map_id' => $map->id,
                            'layer_name' => $layerName,
                            'floor_no' => $floorNo,
                            'image_path' => $imagePath,
                            'source_url' => $map->source_url,
                            'display_order' => (int) ($layer['display_order'] ?? 1),
                        ];

                        if ($exists) {
                            $exists->fill($payload);
                            $exists->save();

                            $this->line(sprintf(
                                '  更新: layer_name=%s / floor_no=%s / image_path=%s',
                                $layerName,
                                $floorNo,
                                $imagePath ?? 'null'
                            ));
                        } else {
                            MapLayer::query()->create($payload);

                            $this->line(sprintf(
                                '  作成: layer_name=%s / floor_no=%s / image_path=%s',
                                $layerName,
                                $floorNo,
                                $imagePath ?? 'null'
                            ));
                        }

                        $savedCount++;
                    }

                    $processed++;
                } catch (Throwable $e) {
                    $this->error('  例外: ' . $e->getMessage());
                    $skipped++;
                }
            }

            $this->newLine();
            $this->info("完了: processed={$processed} / saved={$savedCount} / skipped={$skipped}");

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }

    private function httpClient()
    {
        return Http::withHeaders([
            'Referer' => $this->baseUrl . '/',
            'User-Agent' => 'Mozilla/5.0 (compatible; BackfillMissingMapLayers/1.0)',
            'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
            'Accept-Encoding' => 'gzip, deflate, br',
            'Connection' => 'keep-alive',
        ])
            ->connectTimeout(30)
            ->timeout(120)
            ->retry(3, 2000, function ($exception) {
                $message = $exception?->getMessage() ?? '';

                return str_contains($message, 'cURL error 28')
                    || str_contains($message, 'timed out')
                    || str_contains($message, 'Could not resolve host')
                    || str_contains($message, 'Connection refused');
            });
    }

    private function fetchHtml(string $url): ?string
    {
        try {
            $res = $this->httpClient()->get($url);

            if (!$res->ok()) {
                $this->warn("HTML取得失敗: status={$res->status()} url={$url}");
                return null;
            }

            return $res->body();
        } catch (Throwable $e) {
            $this->warn("HTML取得例外: {$url}");
            $this->warn($e->getMessage());
            return null;
        }
    }

    private function extractLayersFromPage(Crawler $crawler): array
    {
        if ($crawler->filter('div[itemprop="articleBody"]')->count()) {
            $articleBody = $crawler->filter('div[itemprop="articleBody"]')->first();
        } elseif ($crawler->filter('main')->count()) {
            $articleBody = $crawler->filter('main')->first();
        } else {
            $articleBody = $crawler->filter('body')->first();
        }

        $articles = $articleBody->children()->reduce(function (Crawler $node) {
            return strtolower($node->nodeName()) === 'article';
        });

        if ($articles->count() === 0) {
            $articles = $articleBody->filter('article');
        }

        $layers = [];
        $displayOrder = 1;

        foreach ($articles as $node) {
            $section = new Crawler($node, $crawler->getUri());
            $heading = $this->extractSectionHeading($section);

            if (!$this->isMapHeading($heading)) {
                continue;
            }

            $resolvedLayerName = $this->normalizeLayerName($heading) ?: '地上';
            $imageUrls = $this->extractMapImagesFromSection($section);

            foreach ($imageUrls as $idx => $imageUrl) {
                $layerName = $resolvedLayerName;

                if (($layerName === null || $layerName === '地上') && count($imageUrls) > 1) {
                    $layerName = 'layer' . ($idx + 1);
                }

                $layers[] = [
                    'layer_name' => $layerName ?: '地上',
                    'floor_no' => $this->parseFloorNo($layerName ?: '地上'),
                    'display_order' => $displayOrder++,
                    'image_url' => $imageUrl,
                ];
            }
        }

        if (empty($layers)) {
            $fallbackImageUrls = $this->extractMapImagesFromSection($crawler);

            foreach ($fallbackImageUrls as $idx => $imageUrl) {
                $layers[] = [
                    'layer_name' => count($fallbackImageUrls) > 1 ? 'layer' . ($idx + 1) : '地上',
                    'floor_no' => count($fallbackImageUrls) > 1 ? 0 : 1,
                    'display_order' => $displayOrder++,
                    'image_url' => $imageUrl,
                ];
            }
        }

        return $this->dedupeLayers($layers);
    }

    private function extractSectionHeading(Crawler $section): string
    {
        $selectors = [
            'h2',
            'h3',
            'h4',
            'p',
            'strong',
            '.Title',
            '.Heading',
        ];

        foreach ($selectors as $selector) {
            if (!$section->filter($selector)->count()) {
                continue;
            }

            foreach ($section->filter($selector) as $node) {
                $text = $this->normalizeText($node->textContent ?? '');
                if ($text !== '') {
                    return $text;
                }
            }
        }

        return '';
    }

    private function isMapHeading(string $heading): bool
    {
        $heading = trim($heading);

        if ($heading === 'MAP') {
            return true;
        }

        if (preg_match('/地下\s*[0-9]+\s*階/u', $heading)) {
            return true;
        }

        if (preg_match('/(?:^|[^下])([0-9]+)\s*階/u', $heading)) {
            return true;
        }

        if (preg_match('/(上層|中層|下層|屋上|全体図|裏通り|駅|参道|入口|内部|外観)/u', $heading)) {
            return true;
        }

        return false;
    }

    private function normalizeLayerName(string $heading): ?string
    {
        $heading = trim($heading);

        if ($heading === 'MAP') {
            return '地上';
        }

        if (preg_match('/(地下\s*[0-9]+\s*階)/u', $heading, $m)) {
            return preg_replace('/\s+/u', '', $m[1]);
        }

        if (preg_match('/(?:^|[^下])([0-9]+)\s*階/u', $heading, $m)) {
            return $m[1] . '階';
        }

        if (preg_match('/(下層|中層|上層|屋上|全体図|裏通り|駅|参道|入口|内部|外観)/u', $heading, $m)) {
            return $m[1];
        }

        return $heading !== '' ? $heading : '地上';
    }

    private function extractMapImagesFromSection(Crawler $section): array
{
    $urls = [];
    $baseUri = $section->getUri();

    $selectors = [
        '.cMapWrap img',
        'figure.cMap img',
        '.cMap img',
        'picture img',
        'img',
    ];

    foreach ($selectors as $selector) {
        if (!$section->filter($selector)->count()) {
            continue;
        }

        $section->filter($selector)->each(function (Crawler $img) use (&$urls, $baseUri) {
            $candidates = [
                trim((string) $img->attr('src')),
                trim((string) $img->attr('data-src')),
                trim((string) $img->attr('data-original')),
                trim((string) $img->attr('data-lazy-src')),
            ];

            $srcset = trim((string) $img->attr('srcset'));
            if ($srcset !== '') {
                $first = trim(explode(',', $srcset)[0]);
                $first = preg_replace('/\s+\d+w$/u', '', $first);
                $first = preg_replace('/\s+\d+x$/u', '', $first);
                $candidates[] = trim((string) $first);
            }

            foreach ($candidates as $src) {
                if ($src === '') {
                    continue;
                }

                $abs = $this->absoluteUrl($src, $baseUri);

                if (!$this->looksLikeMapImageUrl($abs)) {
                    continue;
                }

                $urls[$abs] = $abs;
            }
        });

        if (!empty($urls)) {
            break;
        }
    }

    if (!empty($urls)) {
        return array_values($urls);
    }

    foreach ($section as $node) {
        if (!method_exists($node, 'getAttribute') || !$node->hasAttribute('style')) {
            continue;
        }

        $style = (string) $node->getAttribute('style');
        if ($style === '') {
            continue;
        }

        if (preg_match_all('/background-image\s*:\s*url\((["\']?)(.*?)\1\)/iu', $style, $matches)) {
            foreach ($matches[2] as $rawUrl) {
                $rawUrl = trim($rawUrl);
                if ($rawUrl === '') {
                    continue;
                }

                $abs = $this->absoluteUrl($rawUrl, $baseUri);

                if (!$this->looksLikeMapImageUrl($abs)) {
                    continue;
                }

                $urls[$abs] = $abs;
            }
        }
    }

    return array_values($urls);
}

    private function looksLikeMapImageUrl(string $url): bool
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';
        $lower = mb_strtolower($path);

        if ($lower === '') {
            return false;
        }

        if (!preg_match('/\.(jpg|jpeg|png|webp|gif)$/i', $lower)) {
            return false;
        }

        if (Str::contains($lower, ['/map/', 'cmap', 'mapimg', 'map_', 'field', 'dungeon', 'town'])) {
            return true;
        }

        return true;
    }

    private function dedupeLayers(array $layers): array
    {
        $unique = [];

        foreach ($layers as $layer) {
            $key = ($layer['layer_name'] ?? '__null__') . '|' . ($layer['image_url'] ?? '');
            $unique[$key] = $layer;
        }

        $layers = array_values($unique);

        usort($layers, function ($a, $b) {
            return ($a['display_order'] ?? 0) <=> ($b['display_order'] ?? 0);
        });

        return $layers;
    }

    private function normalizeLayerKey(?string $layerName): string
    {
        $layerName = trim((string) $layerName);

        if ($layerName === '') {
            return '地上';
        }

        $layerName = preg_replace('/\s+/u', '', $layerName);
        $layerName = str_replace(['Ｂ', 'Ｆ'], ['B', 'F'], $layerName);

        if ($layerName === 'MAP') {
            return '地上';
        }

        if (preg_match('/^B([0-9]+)F$/iu', $layerName, $m)) {
            return '地下' . $m[1] . '階';
        }

        if (preg_match('/^([0-9]+)F$/iu', $layerName, $m)) {
            return $m[1] . '階';
        }

        if (preg_match('/^([0-9]+)$/u', $layerName, $m)) {
            return $m[1] . '階';
        }

        return $layerName;
    }

    private function parseFloorNo(?string $layerName): int
    {
        if ($layerName === null || trim((string) $layerName) === '') {
            return 1;
        }

        $layerName = $this->normalizeLayerKey($layerName);

        if ($layerName === '地上') {
            return 1;
        }

        if (preg_match('/^地下([0-9]+)階$/u', $layerName, $m)) {
            return -1 * (int) $m[1];
        }

        if (preg_match('/^([0-9]+)階$/u', $layerName, $m)) {
            return (int) $m[1];
        }

        if ($layerName === '下層') {
            return -1;
        }

        if ($layerName === '中層') {
            return 1;
        }

        if ($layerName === '上層') {
            return 2;
        }

        if ($layerName === '屋上') {
            return 3;
        }

        return 1;
    }

    private function findExistingLayer(int $mapId, ?string $layerName, ?int $floorNo = null): ?MapLayer
    {
        $normalized = $this->normalizeLayerKey($layerName);

        $query = MapLayer::query()->where('map_id', $mapId);

        if ($normalized !== '') {
            $byName = (clone $query)->where('layer_name', $normalized)->first();
            if ($byName) {
                return $byName;
            }
        }

        if ($floorNo !== null) {
            $byFloor = (clone $query)->where('floor_no', $floorNo)->first();
            if ($byFloor) {
                return $byFloor;
            }
        }

        return null;
    }

    private function downloadImage(
        string $imageUrl,
        int $mapId,
        string $continent,
        int $floorNo,
        ?string $layerName = null
    ): ?string {
        $ext = pathinfo(parse_url($imageUrl, PHP_URL_PATH) ?? '', PATHINFO_EXTENSION);
        $ext = $ext ?: 'jpg';

        $continentDir = $this->continentFolderName($continent);
        $mapDir = sprintf('images/maps/%s/map_id_%d', $continentDir, $mapId);

        $filenameBase = $this->buildLayerFilename($layerName, $floorNo);
        $filename = $filenameBase . '.' . strtolower($ext);

        $storagePath = $mapDir . '/' . $filename;

        if (
            !$this->option('redownload') &&
            Storage::disk('public')->exists($storagePath)
        ) {
            return 'storage/' . $storagePath;
        }

        try {
            $res = $this->httpClient()->get($imageUrl);

            if (!$res->ok()) {
                $this->warn("画像取得失敗: status={$res->status()} url={$imageUrl}");
                return null;
            }

            Storage::disk('public')->put($storagePath, $res->body());

            return 'storage/' . $storagePath;
        } catch (Throwable $e) {
            $this->warn("画像取得例外: {$imageUrl}");
            $this->warn($e->getMessage());
            return null;
        }
    }

    private function absoluteUrl(string $url, ?string $currentUrl = null): string
    {
        if (Str::startsWith($url, ['http://', 'https://'])) {
            return $url;
        }

        if ($currentUrl) {
            if (
                Str::startsWith($url, './')
                || Str::startsWith($url, '../')
                || !Str::startsWith($url, '/')
            ) {
                return $this->resolveRelativeUrl($currentUrl, $url);
            }
        }

        return rtrim($this->baseUrl, '/') . '/' . ltrim($url, '/');
    }

    private function resolveRelativeUrl(string $base, string $relative): string
    {
        if (Str::startsWith($relative, ['http://', 'https://'])) {
            return $relative;
        }

        $baseParts = parse_url($base);
        $scheme = $baseParts['scheme'] ?? 'https';
        $host = $baseParts['host'] ?? parse_url($this->baseUrl, PHP_URL_HOST);
        $path = $baseParts['path'] ?? '/';

        if (Str::startsWith($relative, '/')) {
            return "{$scheme}://{$host}{$relative}";
        }

        $dir = preg_replace('~/[^/]*$~', '/', $path);
        $full = $dir . $relative;

        $segments = [];
        foreach (explode('/', $full) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($segments);
                continue;
            }
            $segments[] = $segment;
        }

        return "{$scheme}://{$host}/" . implode('/', $segments);
    }

    private function buildLayerFilename(?string $layerName, int $floorNo): string
    {
        $layerName = $this->normalizeLayerKey($layerName);

        if ($layerName === '地上') {
            return '1';
        }

        if (preg_match('/^地下([0-9]+)階$/u', $layerName, $m)) {
            return '-' . (int) $m[1];
        }

        if (preg_match('/^([0-9]+)階$/u', $layerName, $m)) {
            return (string) ((int) $m[1]);
        }

        $map = [
            '上層' => 'jousou',
            '中層' => 'chusou',
            '下層' => 'kasou',
            '屋上' => 'okujou',
            '入口' => 'iriguchi',
            '内部' => 'naibu',
            '外観' => 'gaikan',
            '全体図' => 'zentai',
            '裏通り' => 'uradori',
            '駅' => 'eki',
            '参道' => 'sando',
        ];

        if (isset($map[$layerName])) {
            return $map[$layerName];
        }

        $safe = mb_strtolower($layerName);
        $safe = str_replace([' ', '　'], '_', $safe);
        $safe = preg_replace('/[^a-z0-9_\-ぁ-んァ-ヶ一-龠]/u', '', $safe);
        $safe = trim((string) $safe, '_-');

        return $safe !== '' ? $safe : (string) $floorNo;
    }

    private function continentFolderName(string $continent): string
    {
        $continent = $this->normalizeContinentName($continent);

        $map = [
            'オーグリード大陸' => 'ogreed_continent',
            'エルトナ大陸' => 'eltona_continent',
            'ドワチャッカ大陸' => 'dwachakka_continent',
            'プクランド大陸' => 'pukland_continent',
            'ウェナ諸島' => 'wena_islands',
            'レンダーシア' => 'rendercia',
            '偽りのレンダーシア' => 'false_rendercia',
            '真のレンダーシア' => 'true_rendercia',
            'ナドラガンド' => 'nadragand',
            '魔界' => 'makai',
            '天星郷' => 'tenseikyo',
            'キュルルと行く世界' => 'past_5000',
            '果ての大地' => 'zenesia',
            '過去世界' => 'past_world',
            '時の王者' => 'toki_no_oja',
            '不明' => 'unknown',
        ];

        return $map[$continent] ?? 'unknown';
    }

    private function normalizeContinentName(?string $continent): string
    {
        $continent = $this->normalizeText((string) $continent);
        $continent = str_replace([' ', '　'], '', $continent);

        $aliases = [
            'オーグリード' => 'オーグリード大陸',
            'オーグリード大陸' => 'オーグリード大陸',
            'エルトナ' => 'エルトナ大陸',
            'エルトナ大陸' => 'エルトナ大陸',
            'ドワチャッカ' => 'ドワチャッカ大陸',
            'ドワチャッカ大陸' => 'ドワチャッカ大陸',
            'プクランド' => 'プクランド大陸',
            'プクランド大陸' => 'プクランド大陸',
            'ウェナ' => 'ウェナ諸島',
            'ウェナ諸島' => 'ウェナ諸島',
            'レンダーシア' => 'レンダーシア',
            '偽りのレンダーシア' => '偽りのレンダーシア',
            '真のレンダーシア' => '真のレンダーシア',
            'ナドラガンド' => 'ナドラガンド',
            'ナドラガント' => 'ナドラガンド',
            'ナドラガンド大陸' => 'ナドラガンド',
            '魔界' => '魔界',
            '天星郷' => '天星郷',
            '過去世界' => '過去世界',
            '時の王者' => '時の王者',
            'キュルルと行く世界' => 'キュルルと行く世界',
            '果ての大地' => '果ての大地',
            '不明' => '不明',
        ];

        return $aliases[$continent] ?? ($continent ?: '不明');
    }

    private function normalizeText(string $text): string
    {
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/u', ' ', $text);

        return trim((string) $text);
    }
}