<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ImportDraquexFieldSpawnsV6 extends Command
{
    protected $signature = 'dq10:import-draquex-field-v6
                            {list_url : 例 https://draquex.com/monster/field/1-augu.php}
                            {--dry-run : DBに保存しない}
                            {--map= : 特定マップ名だけに絞る}
                            {--download-map-image : マップ画像も保存する}';

    protected $description = 'Draquex の一覧ページから各マップページを巡回して maps / monster_map_spawns に投入する';

    public function handle(): int
    {
        $this->warn('ImportDraquexFieldSpawnsV5 running');

        $listUrl = $this->argument('list_url');
        $dryRun = (bool) $this->option('dry-run');
        $onlyMap = $this->option('map');
        $downloadMapImage = (bool) $this->option('download-map-image');

        $listHtml = $this->fetch($listUrl);

        if (! $listHtml) {
            $this->error("一覧ページ取得失敗: {$listUrl}");
            return self::FAILURE;
        }

        $mapLinks = $this->extractMapLinksFromListPage($listHtml, $listUrl);

        if ($onlyMap) {
            $mapLinks = array_values(array_filter($mapLinks, fn ($row) => $row['map'] === $onlyMap));
        }

        $this->info('対象マップ数: ' . count($mapLinks));
        foreach (array_slice($mapLinks, 0, 10) as $link) {
            $this->line(" - {$link['map']} => {$link['url']}");
        }

        if (empty($mapLinks)) {
            $this->error('マップリンクが1件も取れていない');
            return self::FAILURE;
        }

        $inserted = 0;
        $skipped = 0;

        foreach ($mapLinks as $mapLink) {
            $mapName = $this->normalizeMapName($mapLink['map']);
            $mapUrl = $mapLink['url'];

            $this->newLine();
            $this->info("MAP: {$mapName}");
            $this->line("URL: {$mapUrl}");

            $mapHtml = $this->fetch($mapUrl);
            if (! $mapHtml) {
                $this->warn("  個別ページ取得失敗");
                continue;
            }

            $imageInfo = null;

            if ($downloadMapImage) {
                $imageUrl = $this->extractMapImageUrlFromMapPage($mapHtml, $mapUrl);

                if ($imageUrl) {
                    if ($dryRun) {
                        $ext = strtolower(pathinfo(parse_url($imageUrl, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'jpg');
                        $fileName = $this->mapNameToEnglishFileName($mapName, $ext);

                        $this->line("  [dry-run] map image: {$imageUrl}");
                        $this->line("  [dry-run] image_path: /images/maps/{$fileName}");
                    } else {
                        $imageInfo = $this->downloadMapImage($imageUrl, $mapName);

                        if ($imageInfo) {
                            $this->line("  map image saved: {$imageInfo['full_path']}");
                        } else {
                            $this->warn("  map image save failed: {$imageUrl}");
                        }
                    }
                } else {
                    $this->warn('  map image not found');
                }
            }

            $spawnRows = $this->extractSpawnRowsFromMapPage($mapHtml);
            $this->line('  抽出行数: ' . count($spawnRows));

            if (empty($spawnRows)) {
                $this->warn('  出現情報が見つからない');
                continue;
            }

            $map = DB::table('maps')->where('name', $mapName)->first();

            if (! $map && ! $dryRun) {
                DB::table('maps')->insert([
                    'name' => $mapName,
                    'image_path' => $imageInfo['db_path'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $map = DB::table('maps')->where('name', $mapName)->first();
                $this->line("  maps に追加: {$mapName}");
            }

            if (! $map && $dryRun) {
                $this->line("  [dry-run] maps に追加予定: {$mapName}");
                $map = (object) [
                    'id' => 0,
                    'name' => $mapName,
                ];
            }

            if (! $map) {
                $this->warn("  maps 登録失敗: {$mapName}");
                $skipped++;
                continue;
            }

            if (! $dryRun && $map && $imageInfo && ! empty($imageInfo['db_path'])) {
                DB::table('maps')
                    ->where('id', $map->id)
                    ->update([
                        'image_path' => $imageInfo['db_path'],
                        'updated_at' => now(),
                    ]);
            }

            $grouped = [];

            foreach ($spawnRows as $row) {
                $monsterName = $this->normalizeMonsterName($row['monster']);
                $description = $row['description'];

                if ($monsterName === '') {
                    continue;
                }

                $monster = DB::table('monsters')->where('name', $monsterName)->first();
                if (! $monster) {
                    $this->warn("  monsters に未登録: {$monsterName}");
                    $skipped++;
                    continue;
                }

                $spawnTime = $this->detectSpawnTime($description);
                $coords = $this->extractCoords($description);
                $notes = [];

                if (empty($coords)) {
                    $coords = $this->inferCoordsFromText($description);
                }

                if (empty($coords)) {
                    $notes[] = $description;
                }

                $key = $monster->id . '|' . $map->id . '|' . $spawnTime;

                if (! isset($grouped[$key])) {
                    $grouped[$key] = [
                        'monster_id' => $monster->id,
                        'monster_name' => $monsterName,
                        'map_id' => $map->id,
                        'map_name' => $mapName,
                        'spawn_time' => $spawnTime,
                        'coords' => [],
                        'notes' => [],
                    ];
                }

                $grouped[$key]['coords'] = array_merge($grouped[$key]['coords'], $coords);
                $grouped[$key]['notes'] = array_merge($grouped[$key]['notes'], $notes);
            }

            foreach ($grouped as $item) {
                $coords = array_values(array_unique($item['coords']));
                sort($coords);

                $notes = array_values(array_unique(array_filter($item['notes'])));

                if ($dryRun) {
                    $debug = [
                        'monster' => $item['monster_name'],
                        'coords' => $coords,
                        'spawn_time' => $item['spawn_time'],
                        'map' => $item['map_name'],
                        'note' => $notes,
                    ];

                    $this->line('  ' . json_encode($debug, JSON_UNESCAPED_UNICODE));
                } else {
                    $exists = DB::table('monster_map_spawns')
                        ->where('monster_id', $item['monster_id'])
                        ->where('map_id', $item['map_id'])
                        ->where('spawn_time', $item['spawn_time'])
                        ->exists();

                    if ($exists) {
                        DB::table('monster_map_spawns')
                            ->where('monster_id', $item['monster_id'])
                            ->where('map_id', $item['map_id'])
                            ->where('spawn_time', $item['spawn_time'])
                            ->update([
                                'area' => json_encode($coords, JSON_UNESCAPED_UNICODE),
                                'note' => json_encode($notes, JSON_UNESCAPED_UNICODE),
                                'updated_at' => now(),
                            ]);
                    } else {
                        DB::table('monster_map_spawns')->insert([
                            'monster_id' => $item['monster_id'],
                            'map_id' => $item['map_id'],
                            'spawn_time' => $item['spawn_time'],
                            'area' => json_encode($coords, JSON_UNESCAPED_UNICODE),
                            'note' => json_encode($notes, JSON_UNESCAPED_UNICODE),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }

                $inserted++;
            }
        }

        $this->newLine();
        $this->info("完了 inserted={$inserted} skipped={$skipped}");

        return self::SUCCESS;
    }

    private function fetch(string $url): ?string
    {
        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                    'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
                    'Referer' => 'https://draquex.com/',
                ])
                ->get($url);

            if (! $response->ok()) {
                $this->warn("HTTP {$response->status()} : {$url}");
                return null;
            }

            return $response->body();
        } catch (\Throwable $e) {
            $this->warn($e->getMessage());
            return null;
        }
    }

    private function extractMapLinksFromListPage(string $html, string $baseUrl): array
    {
        $xpath = $this->makeXPath($html);
        $links = [];

        foreach ($xpath->query('//main[contains(@class,"page")]//section[contains(@class,"item")]//a[@href]') as $a) {
            $href = trim($a->getAttribute('href'));

            if ($href === '') {
                continue;
            }

            if (! preg_match('#(?:^|/)[a-z]-\d+\.php$#i', $href)) {
                continue;
            }

            if (preg_match('#(?:^|/)1-[a-z0-9_-]+\.php$#i', $href)) {
                continue;
            }

            $url = $this->absoluteUrl($baseUrl, $href);

            $name = trim(preg_replace('/\s+/u', ' ', $a->textContent));
            $name = preg_replace('/\s*\(.*?\)\s*/u', '', $name);
            $name = $this->normalizeMapName($name);

            if ($name === '') {
                $name = $this->fetchMapNameFromPageUrl($url);
            }

            $links[] = [
                'map' => $name,
                'url' => $url,
            ];
        }

        return $this->uniqueByUrl($links);
    }

    private function fetchMapNameFromPageUrl(string $url): string
    {
        $html = $this->fetch($url);

        if (! $html) {
            return basename($url, '.php');
        }

        if (preg_match('/<title>(.*?)にいるモンスター\|/u', $html, $m)) {
            return $this->normalizeMapName(trim(strip_tags($m[1])));
        }

        if (preg_match('/<h1[^>]*>(.*?)にいるモンスター/u', $html, $m)) {
            return $this->normalizeMapName(trim(strip_tags($m[1])));
        }

        return basename($url, '.php');
    }

    private function extractMapImageUrlFromMapPage(string $html, string $baseUrl): ?string
    {
        $xpath = $this->makeXPath($html);

        foreach ($xpath->query('//a[@href]') as $a) {
            $href = trim($a->getAttribute('href'));

            if ($href !== '' && preg_match('#/assets/img-map/.*\.(jpg|jpeg|png|gif|webp)$#i', $href)) {
                return $this->absoluteUrl($baseUrl, $href);
            }
        }

        foreach ($xpath->query('//img[@src]') as $img) {
            $src = trim($img->getAttribute('src'));

            if ($src !== '' && preg_match('#/assets/img-map/.*\.(jpg|jpeg|png|gif|webp)$#i', $src)) {
                return $this->absoluteUrl($baseUrl, $src);
            }
        }

        return null;
    }

    private function downloadMapImage(string $imageUrl, string $mapName): ?array
    {
        try {
            $response = Http::timeout(60)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                    'Referer' => 'https://draquex.com/',
                ])
                ->get($imageUrl);

            if (! $response->ok()) {
                return null;
            }

            $ext = strtolower(pathinfo(parse_url($imageUrl, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'jpg');
            $fileName = $this->mapNameToEnglishFileName($mapName, $ext);

            $relativePath = 'images/maps/' . $fileName;
            $publicPath = public_path($relativePath);

            if (! is_dir(dirname($publicPath))) {
                mkdir(dirname($publicPath), 0777, true);
            }

            file_put_contents($publicPath, $response->body());

            return [
                'file_name' => $fileName,
                'db_path' => '/' . $relativePath,
                'full_path' => $publicPath,
            ];
        } catch (\Throwable $e) {
            $this->warn($e->getMessage());
            return null;
        }
    }

    private function extractSpawnRowsFromMapPage(string $html): array
    {
        $rows = [];
        $xpath = $this->makeXPath($html);

        foreach ($xpath->query('//table//tr') as $tr) {
            $tds = $tr->getElementsByTagName('td');
            if ($tds->length < 2) {
                continue;
            }

            $monster = trim(preg_replace('/\s+/u', ' ', $tds->item(0)->textContent));
            $description = trim(preg_replace('/\s+/u', ' ', $tds->item(1)->textContent));

            if ($monster === '' || $description === '') {
                continue;
            }

            if (! $this->looksLikeMonsterName($monster)) {
                continue;
            }

            $rows[] = [
                'monster' => $monster,
                'description' => $description,
            ];
        }

        return $this->uniqueSpawnRows($rows);
    }

    private function looksLikeMonsterName(string $text): bool
    {
        $ngWords = [
            'どのあたりにいるか',
            '出現モンスター',
            'マップ',
            '場所',
            '系統',
            '経験値',
            'ゴールド',
            '特訓',
            '宝珠',
            '白宝箱',
            '転生',
            '注意',
            '昼のみ',
            '夜のみ',
        ];

        foreach ($ngWords as $ng) {
            if (mb_strpos($text, $ng) !== false) {
                return false;
            }
        }

        return true;
    }

    private function normalizeMonsterName(string $name): string
    {
        $name = trim($name);
        $name = preg_replace('/\s+/u', '', $name);
        $name = preg_replace('/（昼）|（夜）|\(昼\)|\(夜\)/u', '', $name);
        return trim($name);
    }

    private function normalizeMapName(string $name): string
    {
        $name = trim(preg_replace('/\s+/u', ' ', $name));
        $name = preg_replace('/にいるモンスター$/u', '', $name);
        return trim($name);
    }

    private function detectSpawnTime(string $text): string
    {
        if (mb_strpos($text, '夜のみ') !== false || mb_strpos($text, '夜だけ') !== false) {
            return 'night';
        }

        if (mb_strpos($text, '昼のみ') !== false || mb_strpos($text, '昼だけ') !== false) {
            return 'day';
        }

        return 'normal';
    }

    private function extractCoords(string $text): array
    {
        $coords = [];

        if (preg_match_all('/([A-H])-([1-8])\s*[～〜~\-]+\s*([A-H])-([1-8])/u', $text, $rangeMatches, PREG_SET_ORDER)) {
            foreach ($rangeMatches as $m) {
                $coords = array_merge(
                    $coords,
                    $this->expandRange($m[1], (int) $m[2], $m[3], (int) $m[4])
                );
            }
        }

        if (preg_match_all('/([A-H])-([1-8])/u', $text, $singleMatches, PREG_SET_ORDER)) {
            foreach ($singleMatches as $m) {
                $coords[] = $m[1] . $m[2];
            }
        }

        $coords = array_values(array_unique($coords));

        if (count($coords) > 8) {
            $coords = array_slice($coords, 0, 8);
        }

        return $coords;
    }

    private function inferCoordsFromText(string $text): array
    {
        $patterns = [
            'マップ中央' => ['D4', 'E4', 'D5', 'E5'],
            '中央' => ['D4', 'E4', 'D5', 'E5'],
            '北部' => ['D2', 'E2', 'D3'],
            '南部' => ['D7', 'E7', 'F7'],
            '東部' => ['F4', 'G4', 'G5'],
            '西部' => ['B4', 'C4', 'B5'],
            '北西' => ['B2', 'C2'],
            '北東' => ['F2', 'G2'],
            '南西' => ['B7', 'C7'],
            '南東' => ['F7', 'G7'],
            '上のほう' => ['D2', 'E2'],
            '下のほう' => ['D7', 'E7'],
            '左のほう' => ['B4', 'C4'],
            '右のほう' => ['F4', 'G4'],
            'たくさん' => ['D4', 'E4', 'D5', 'E5'],
        ];

        foreach ($patterns as $keyword => $coords) {
            if (mb_strpos($text, $keyword) !== false) {
                return $coords;
            }
        }

        $namedHints = [
            'ランガーオ村' => ['E2', 'F2'],
            'ロンダの氷穴' => ['B3', 'C3'],
            'ナグアの洞くつ' => ['C5', 'D5'],
            '獅子門' => ['B7', 'C7'],
            '橋の近く' => ['D4', 'E4'],
            '洞くつの近く' => ['C5', 'D5'],
            '村の近く' => ['E2', 'F2'],
        ];

        foreach ($namedHints as $keyword => $coords) {
            if (mb_strpos($text, $keyword) !== false) {
                return $coords;
            }
        }

        return [];
    }

    private function expandRange(string $col1, int $row1, string $col2, int $row2): array
    {
        $c1 = ord($col1);
        $c2 = ord($col2);

        $colStart = min($c1, $c2);
        $colEnd = max($c1, $c2);
        $rowStart = min($row1, $row2);
        $rowEnd = max($row1, $row2);

        $coords = [];

        for ($c = $colStart; $c <= $colEnd; $c++) {
            for ($r = $rowStart; $r <= $rowEnd; $r++) {
                $coords[] = chr($c) . $r;
            }
        }

        return $coords;
    }

    private function mapNameToEnglishFileName(string $mapName, string $ext = 'jpg'): string
    {
        $map = [
            'コルット地方' => 'korutto-region',
            'レーナム緑野' => 'reenamu-green-field',
            'シエラ巡礼地' => 'shiera-pilgrimage-site',
            '地底湖の洞くつ' => 'underground-lake-cave',
            '祈りの宿' => 'inn-of-prayer',
            'ジュレー島上層' => 'jure-island-upper',
            'ジュレー島下層' => 'jure-island-lower',
            'ミューズ海岸' => 'muse-coast',
            '猫島' => 'cat-island',
            'ヴェリナード領西' => 'verinard-west',
            'ヴェリナード領南' => 'verinard-south',
            'ヴェリナード領北' => 'verinard-north',
            'キュララナ海岸' => 'kyurarana-coast',
            'キュララナビーチ' => 'kyurarana-beach',
            '海のとける洞くつ' => 'melting-sea-cave',
            '永遠の地下迷宮' => 'eternal-underground-maze',

            'ランガーオ山地' => 'langao-mountain',
            'ラギ雪原' => 'ragi-snowfield',
            'ロンダの氷穴' => 'ronda-ice-cave',
            'グレン領東' => 'gren-east',
            'グレン領西' => 'gren-west',
            'ベコン渓谷' => 'vekon-valley',
            'ゲルト海峡' => 'geruto-strait',
            'ランドン山脈' => 'landon-mountains',
            'ザマ峠' => 'zama-pass',
            'ギルザッド地方' => 'gilzad-region',
        ];

        if (isset($map[$mapName])) {
            return $map[$mapName] . '.' . $ext;
        }

        $fallback = mb_strtolower($mapName, 'UTF-8');
        $fallback = preg_replace('/[^a-z0-9]+/i', '-', $fallback);
        $fallback = trim($fallback, '-');

        if ($fallback === '') {
            $fallback = 'map-' . md5($mapName);
        }

        return $fallback . '.' . $ext;
    }

    private function absoluteUrl(string $baseUrl, string $href): string
    {
        if (str_starts_with($href, 'http://') || str_starts_with($href, 'https://')) {
            return $href;
        }

        $parts = parse_url($baseUrl);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';

        if (str_starts_with($href, '/')) {
            return $scheme . '://' . $host . $href;
        }

        $path = $parts['path'] ?? '/';
        $dir = rtrim(str_replace('\\', '/', dirname($path)), '/');

        return $scheme . '://' . $host . ($dir ? $dir . '/' : '/') . ltrim($href, '/');
    }

    private function uniqueByUrl(array $items): array
    {
        $seen = [];
        $result = [];

        foreach ($items as $item) {
            if (isset($seen[$item['url']])) {
                continue;
            }

            $seen[$item['url']] = true;
            $result[] = $item;
        }

        return $result;
    }

    private function uniqueSpawnRows(array $rows): array
    {
        $seen = [];
        $result = [];

        foreach ($rows as $row) {
            $key = $row['monster'] . '|' . $row['description'];

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $result[] = $row;
        }

        return $result;
    }

    private function makeXPath(string $html): \DOMXPath
    {
        libxml_use_internal_errors(true);

        $dom = new \DOMDocument();
        $dom->loadHTML('<?xml encoding="UTF-8">' . $html);

        libxml_clear_errors();

        return new \DOMXPath($dom);
    }
}