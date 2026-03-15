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

class DraquexMapDownload extends Command
{
    protected $signature = 'dq10:draquex-map-download
        {list_url : MAP一覧URL}
        {--folder-name= : 保存先フォルダ名を強制指定}
        {--continent= : DB保存用 continent を強制指定}
        {--map-type=field : DB保存時の map_type}
        {--dry-run : 保存しない}
        {--only= : 指定文字列を含むマップ名だけ処理}
        {--redownload : 既存画像があっても再取得する}';

    protected $description = 'Draquex MAP一覧ページから詳細ページへ進み、画像保存と maps / map_layers の不足分を補完する';

    public function handle(): int
    {
        $listUrl = trim((string) $this->argument('list_url'));
        $folderNameOption = trim((string) $this->option('folder-name'));
        $continentOption = trim((string) $this->option('continent'));
        $mapType = trim((string) $this->option('map-type')) ?: 'field';
        $dryRun = (bool) $this->option('dry-run');
        $only = trim((string) $this->option('only'));
        $redownload = (bool) $this->option('redownload');
        $html = $this->fetchHtml($listUrl);

        $crawler = new Crawler($html, $listUrl);

        /*
        |--------------------------------------------------------------------------
        | continent を一覧ページのタイトルから取得
        |--------------------------------------------------------------------------
        */

        $continent = '';

        if ($crawler->filter('h1.h1-page')->count()) {
            $continent = trim($crawler->filter('h1.h1-page')->first()->text());
        }

        $this->info("continent detected: {$continent}");
        $this->info("list url: {$listUrl}");

        try {
            $html = $this->fetchHtml($listUrl);
        } catch (Throwable $e) {
            $this->error('一覧ページ取得失敗: ' . $e->getMessage());
            return self::FAILURE;
        }

        $crawler = new Crawler($html, $listUrl);
        $maps = $this->extractMapsFromListPage($crawler, $listUrl, $continent);

        if ($only !== '') {
            $maps = array_values(array_filter($maps, function (array $row) use ($only) {
                return Str::contains($row['name'], $only);
            }));
        }

        $this->info('map count: ' . count($maps));

        if (empty($maps)) {
            $this->warn('対象マップが見つからなかった');
            return self::SUCCESS;
        }

        foreach ($maps as $row) {
            $name = $row['name'];
            $detailUrl = $row['url'];

            $continent = $continentOption !== '' ? $continentOption : $row['continent'];
            $folderName = $folderNameOption !== '' ? $folderNameOption : $continent;

            $this->line('');
            $this->info("MAP: {$name}");
            $this->line("URL: {$detailUrl}");
            $this->line("continent: {$continent}");
            $this->line("folder: {$folderName}");

            $mapModel = $this->findOrCreateMap(
                name: $name,
                continent: $continent,
                mapType: $mapType,
                sourceUrl: $detailUrl,
                dryRun: $dryRun
            );

            if (!$mapModel) {
                $this->warn("map model を作れなかった: {$name}");
                continue;
            }

            $this->line("map_id: {$mapModel->id}");

            try {
                $this->downloadImagesAndStoreMissingLayers(
                    url: $detailUrl,
                    map: $mapModel,
                    folderName: $folderName,
                    dryRun: $dryRun,
                    redownload: $redownload
                );
            } catch (Throwable $e) {
                $this->error("画像取得失敗: {$e->getMessage()}");
            }
        }

        $this->line('');
        $this->info('done');

        return self::SUCCESS;
    }

    private function extractMapsFromListPage(
    Crawler $crawler,
    string $listUrl,
    string $continent
): array {

    $rows = [];

    $crawler->filter('li > a.arrow[href]')->each(function (Crawler $a) use (&$rows, $listUrl, $continent) {

        $href = trim((string)$a->attr('href'));
        if ($href === '') {
            return;
        }

        $rawName = $this->normalizeText($a->text());

        $name = $this->cleanupMapName($rawName);

        if ($name === '') {
            return;
        }

        $rows[] = [
            'name' => $name,
            'continent' => $continent,
            'url' => $this->absoluteUrl($href, $listUrl),
        ];
    });

    $unique = [];
    foreach ($rows as $row) {
        $unique[$row['url']] = $row;
    }

    return array_values($unique);
}

    private function findOrCreateMap(
        string $name,
        string $continent,
        string $mapType,
        string $sourceUrl,
        bool $dryRun
    ): ?Map {
        $map = Map::query()
            ->where('source_url', $sourceUrl)
            ->orWhere(function ($query) use ($name, $continent) {
                $query->where('name', $name);

                if ($continent !== '' && $continent !== '不明') {
                    $query->where('continent', $continent);
                }
            })
            ->first();

        if ($map) {
            $updates = [];

            if (!$map->source_url) {
                $updates['source_url'] = $sourceUrl;
            }
            if ((!$map->continent || $map->continent === '不明') && $continent !== '') {
                $updates['continent'] = $continent;
            }
            if (!$map->map_type && $mapType !== '') {
                $updates['map_type'] = $mapType;
            }

            if (!$dryRun && !empty($updates)) {
                $map->fill($updates);
                $map->save();
                $map->refresh();
            }

            return $map;
        }

        if ($dryRun) {
            $dummy = new Map();
            $dummy->id = 0;
            $dummy->name = $name;
            $dummy->continent = $continent !== '' ? $continent : '不明';
            $dummy->map_type = $mapType;
            $dummy->source_url = $sourceUrl;

            $this->line("dry-run: maps に新規登録予定 name={$name}");

            return $dummy;
        }

        $created = Map::create([
            'continent' => $continent !== '' ? $continent : '不明',
            'name' => $name,
            'map_type' => $mapType !== '' ? $mapType : 'field',
            'source_url' => $sourceUrl,
        ]);

        $this->line("created map: id={$created->id}");

        return $created;
    }

    private function downloadImagesAndStoreMissingLayers(
        string $url,
        Map $map,
        string $folderName,
        bool $dryRun,
        bool $redownload
    ): void {
        $html = $this->fetchHtml($url);
        $crawler = new Crawler($html, $url);

        $images = $this->extractMapImages($crawler, $url);

        $this->line('image count: ' . count($images));

        if (empty($images)) {
            $this->warn('画像が見つからなかった');
            return;
        }

        $safeFolder = $this->sanitizePathSegment($folderName !== '' ? $folderName : $map->continent);
        $storageDir = "images/maps/{$safeFolder}/map_id_{$map->id}";

        foreach ($images as $index => $row) {
            $displayOrder = $index + 1;
            $floorNo = $this->guessFloorNo($row['label'], $displayOrder);
            $layerName = $this->guessLayerName($row['label'], $floorNo, $displayOrder);

            $ext = $this->guessExtensionFromUrl($row['url']);
            $filename = "{$displayOrder}.{$ext}";

            // 実保存先
            $storagePath = "{$storageDir}/{$filename}";
            // DB保存値
            $dbImagePath = "storage/{$storagePath}";

            $this->line("download: {$row['url']}");
            $this->line("label   : {$row['label']}");
            $this->line("layer   : {$layerName}");
            $this->line("floor_no: {$floorNo}");
            $this->line("storage : {$storagePath}");
            $this->line("db path : {$dbImagePath}");

            if (!$dryRun) {
                if ($redownload || !Storage::disk('public')->exists($storagePath)) {
                    $binary = $this->fetchBinary($row['url']);
                $croppedBinary = $this->cropTopPixels($binary, 61);

                Storage::disk('public')->put($storagePath, $croppedBinary);
   
                } else {
                    $this->line('exists: skip download');
                }

                $this->createMapLayerIfMissing(
                    mapId: $map->id,
                    layerName: $layerName,
                    floorNo: $floorNo,
                    imagePath: $dbImagePath,
                    sourceUrl: $row['url'],
                    displayOrder: $displayOrder
                );
            }
        }
    }

    private function extractMapImages(Crawler $crawler, string $detailUrl): array
    {
        $rows = [];

        $crawler->filter('img[src]')->each(function (Crawler $img) use (&$rows, $detailUrl) {
            $src = trim((string) $img->attr('src'));
            if ($src === '') {
                return;
            }

            $lowerSrc = Str::lower($src);
            $alt = $this->normalizeText($img->attr('alt'));
            $class = Str::lower(trim((string) $img->attr('class')));

            $looksLikeMap =
                Str::contains($lowerSrc, ['map', '/m/', '/map/']) ||
                Str::contains(Str::lower($alt), ['map', 'マップ']) ||
                Str::contains($class, ['map']);

            if (!$looksLikeMap) {
                return;
            }

            if (Str::contains($lowerSrc, ['icon', 'arrow', 'btn', 'banner', 'logo', 'line'])) {
                return;
            }

            $label = $this->cleanupLayerLabel($alt);

            $rows[] = [
                'url' => $this->absoluteUrl($src, $detailUrl),
                'label' => $label,
            ];
        });

        $unique = [];
        foreach ($rows as $row) {
            $unique[$row['url']] = $row;
        }

        return array_values($unique);
    }

    private function createMapLayerIfMissing(
        int $mapId,
        string $layerName,
        int $floorNo,
        string $imagePath,
        string $sourceUrl,
        int $displayOrder
    ): void {
        $existing = MapLayer::query()
            ->where('map_id', $mapId)
            ->where(function ($query) use ($displayOrder, $floorNo, $sourceUrl) {
                $query->where('display_order', $displayOrder)
                    ->orWhere('floor_no', $floorNo)
                    ->orWhere('source_url', $sourceUrl);
            })
            ->first();

        if ($existing) {
            $this->line("map_layer exists: skip (id={$existing->id})");
            return;
        }

        $layer = MapLayer::create([
            'map_id' => $mapId,
            'layer_name' => $layerName,
            'floor_no' => $floorNo,
            'image_path' => $imagePath,
            'source_url' => $sourceUrl,
            'display_order' => $displayOrder,
        ]);

        $this->line("map_layer created: id={$layer->id}");
    }
private function cropTopPixels(string $binary, int $cropTop = 61): string
{
    $source = @imagecreatefromstring($binary);

    if (!$source) {
        throw new \RuntimeException('画像の読み込みに失敗した');
    }

    $width = imagesx($source);
    $height = imagesy($source);

    if ($width <= 0 || $height <= 0) {
        imagedestroy($source);
        throw new \RuntimeException('画像サイズの取得に失敗した');
    }

    // 画像が小さすぎる場合はそのまま返す
    if ($height <= $cropTop) {
        ob_start();
        imagejpeg($source, null, 90);
        $raw = ob_get_clean();
        imagedestroy($source);

        if ($raw === false) {
            throw new \RuntimeException('画像の出力に失敗した');
        }

        return $raw;
    }

    $croppedHeight = $height - $cropTop;

    $cropped = imagecreatetruecolor($width, $croppedHeight);

    // PNG/GIF対策で透明保持
    imagealphablending($cropped, false);
    imagesavealpha($cropped, true);
    $transparent = imagecolorallocatealpha($cropped, 0, 0, 0, 127);
    imagefill($cropped, 0, 0, $transparent);

    imagecopy(
        $cropped,
        $source,
        0,
        0,
        0,
        $cropTop,
        $width,
        $croppedHeight
    );

    ob_start();
    imagejpeg($cropped, null, 90);
    $raw = ob_get_clean();

    imagedestroy($source);
    imagedestroy($cropped);

    if ($raw === false) {
        throw new \RuntimeException('切り抜き画像の出力に失敗した');
    }

    return $raw;
}
    private function guessFloorNo(string $label, int $displayOrder): int
{
    $label = $this->normalizeText($label);

    if ($label !== '') {

        if (preg_match('/地下\s*([0-9]+)\s*階/u', $label, $m)) {
            return -1 * (int)$m[1];
        }

        if (preg_match('/地下\s*([0-9]+)/u', $label, $m)) {
            return -1 * (int)$m[1];
        }

        if (preg_match('/B\s*([0-9]+)\s*F/i', $label, $m)) {
            return -1 * (int)$m[1];
        }

        if (preg_match('/([0-9]+)\s*階/u', $label, $m)) {
            return (int)$m[1];
        }

        if (preg_match('/([0-9]+)\s*F/i', $label, $m)) {
            return (int)$m[1];
        }

        if (Str::contains($label, ['地上'])) {
            return 1;
        }
    }

    // 階層情報が無い場合
    return $displayOrder;
}

    private function guessLayerName(string $label, int $floorNo, int $displayOrder): string
    {
        $label = $this->cleanupLayerLabel($label);

        if ($label !== '') {
            return $label;
        }

        if ($floorNo < 0) {
            return '地下' . abs($floorNo) . '階';
        }

        if ($floorNo === 0) {
            return '地上';
        }

        if ($floorNo === 1) {
            return $displayOrder === 1 ? '地上' : '1階';
        }

        return $floorNo . '階';
    }

    private function cleanupLayerLabel(?string $text): string
    {
        $text = $this->normalizeText($text);

        if ($text === '') {
            return '';
        }

        $lower = mb_strtolower($text);

        $ngWords = [
            '画像',
            'img',
            'image',
            'map',
            'マップ画像',
            '地図画像',
        ];

        foreach ($ngWords as $ngWord) {
            if ($lower === mb_strtolower($ngWord)) {
                return '';
            }
        }

        $text = preg_replace('/（.+?）|\(.+?\)/u', '', $text) ?? $text;
        $text = trim($text);

        if (preg_match('/地下\s*[0-9]+\s*階/u', $text, $m)) {
            return preg_replace('/\s+/u', '', $m[0]) ?? $m[0];
        }

        if (preg_match('/B\s*[0-9]+\s*F/i', $text, $m)) {
            return strtoupper(str_replace(' ', '', $m[0]));
        }

        if (preg_match('/[0-9]+\s*階/u', $text, $m)) {
            return preg_replace('/\s+/u', '', $m[0]) ?? $m[0];
        }

        if (Str::contains($text, ['地上'])) {
            return '地上';
        }

        return '';
    }

    private function fetchHtml(string $url): string
    {
        $response = Http::timeout(30)
            ->retry(2, 1000)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0',
                'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
            ])
            ->get($url);

        $response->throw();

        return (string) $response->body();
    }

    private function fetchBinary(string $url): string
    {
        $response = Http::timeout(60)
            ->retry(2, 1000)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0',
                'Referer' => 'https://draquex.com/',
            ])
            ->get($url);

        $response->throw();

        return (string) $response->body();
    }

    private function cleanupMapName(string $text): string
    {
        $text = $this->normalizeText($text);
        $text = preg_replace('/（.+?）|\(.+?\)/u', '', $text) ?? $text;
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        return trim($text);
    }

   private function cleanupBracketText(string $text): string
{
    $text = $this->normalizeText($text);

    // ( ) や （ ）削除
    $text = preg_replace('/^（|）$|^\(|\)$/u', '', $text) ?? $text;

    // 魔界・大魔王領 → 魔界
    if (mb_strpos($text, '・') !== false) {
        $text = explode('・', $text)[0];
    }

    return trim($text);
}

    private function normalizeText(?string $text): string
    {
        $text = (string) $text;
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        return trim($text);
    }

    private function absoluteUrl(string $url, string $baseUrl): string
    {
        if (preg_match('/^https?:\/\//i', $url)) {
            return $url;
        }

        if (str_starts_with($url, '//')) {
            return 'https:' . $url;
        }

        $base = parse_url($baseUrl);
        $scheme = $base['scheme'] ?? 'https';
        $host = $base['host'] ?? '';
        $port = isset($base['port']) ? ':' . $base['port'] : '';
        $basePath = $base['path'] ?? '/';

        if (str_starts_with($url, '/')) {
            return "{$scheme}://{$host}{$port}{$url}";
        }

        $dir = rtrim(str_replace('\\', '/', dirname($basePath)), '/');
        $full = ($dir ? $dir . '/' : '/') . $url;

        return "{$scheme}://{$host}{$port}{$full}";
    }

    private function sanitizePathSegment(?string $value): string
    {
        $value = trim((string) $value);
        $value = str_replace(['\\', '/'], '-', $value);
        return $value !== '' ? $value : 'unknown';
    }

    private function guessExtensionFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)
            ? $ext
            : 'jpg';
    }
}