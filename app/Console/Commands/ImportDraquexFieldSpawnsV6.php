<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ImportDraquexFieldSpawnsV6 extends Command
{
    protected $signature = 'dq10:import-draquex-field-v6
                            {list_url : 例 https://draquex.com/map/1-augu.php}
                            {--dry-run : DBに保存しない}
                            {--map= : 特定マップ名だけに絞る}
                            {--download-map-image : マップ画像も保存する}';

    protected $description = 'Draquex の一覧ページから各マップページを巡回して maps / monster_map_spawns に投入する';

    public function handle(): int
    {
        $this->warn('ImportDraquexFieldSpawnsV7 running');

        $listUrl = $this->argument('list_url');
        $dryRun = (bool) $this->option('dry-run');
        $onlyMap = $this->option('map');
        $downloadMapImage = (bool) $this->option('download-map-image');

        $continentKey = $this->detectContinentKeyFromListUrl($listUrl);

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
        foreach (array_slice($mapLinks, 0, 20) as $link) {
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
                $this->warn('  個別ページ取得失敗');
                continue;
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
                    'image_path' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $map = DB::table('maps')->where('name', $mapName)->first();
                $this->line("  maps に追加: {$mapName}");
            }

            if (! $map && $dryRun) {
                $this->line("  [dry-run] maps に追加予定: {$mapName}");
                $map = (object) [
                    'id' => 1,
                    'name' => $mapName,
                ];
            }

            if (! $map) {
                $this->warn("  maps 登録失敗: {$mapName}");
                $skipped++;
                continue;
            }

            if ($downloadMapImage) {
                $imageUrl = $this->extractMapImageUrlFromMapPage($mapHtml, $mapUrl);

                if ($imageUrl) {
                    if ($dryRun) {
                        $ext = strtolower(pathinfo(parse_url($imageUrl, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'jpg');
                        $fileName = $this->buildMapImageFileName($continentKey, (int) $map->id, $ext);

                        $this->line("  [dry-run] map image: {$imageUrl}");
                        $this->line("  [dry-run] image_path: /images/maps/{$continentKey}/{$fileName}");
                    } else {
                        $imageInfo = $this->downloadMapImage($imageUrl, $continentKey, (int) $map->id);

                        if ($imageInfo) {
                            DB::table('maps')
                                ->where('id', $map->id)
                                ->update([
                                    'image_path' => $imageInfo['db_path'],
                                    'updated_at' => now(),
                                ]);

                            $this->line("  map image saved: {$imageInfo['full_path']}");
                        } else {
                            $this->warn("  map image save failed: {$imageUrl}");
                        }
                    }
                } else {
                    $this->warn('  map image not found');
                }
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

                if (empty($coords)) {
                    $coords = $this->inferCoordsFromText($description);
                }

                $notes = [$description];

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
                ->withoutVerifying()
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
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

        foreach ($xpath->query('//a[@href]') as $a) {
            $href = trim($a->getAttribute('href'));

            if ($href === '') {
                continue;
            }

            if (preg_match('#(?:^|/)1-[a-z0-9_-]+\.php$#i', $href)) {
                continue;
            }

            if (! preg_match('#(?:^|/)[a-z][a-z0-9_-]*-\d+\.php$#i', $href)) {
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

        foreach ($xpath->query('//meta[@property="og:image"][@content]') as $meta) {
            $content = trim($meta->getAttribute('content'));

            if ($content !== '' && preg_match('#/assets/img-map/.*\.(jpg|jpeg|png|gif|webp)$#i', $content)) {
                return $this->absoluteUrl($baseUrl, $content);
            }
        }

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

    private function downloadMapImage(string $imageUrl, string $continentKey, int $mapId): ?array
    {
        try {
            $response = Http::timeout(60)
                ->withoutVerifying()
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                    'Referer' => 'https://draquex.com/',
                ])
                ->get($imageUrl);

            if (! $response->ok()) {
                return null;
            }

            $ext = strtolower(pathinfo(parse_url($imageUrl, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'jpg');
            $fileName = $this->buildMapImageFileName($continentKey, $mapId, $ext);

            $relativePath = 'images/maps/' . $continentKey . '/' . $fileName;
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

        if (count($coords) > 0) {
            sort($coords);
            return $coords;
        }

        return [];
    }

    private function inferCoordsFromText(string $text): array
    {
        $text = trim($text);

        $matched = [];

        $directionPatterns = [
    [
        'keywords' => ['北東', '北東側', '北東部', '北東方面', '北東エリア', '右上', '右上側', '右上部'],
        'cols' => ['E', 'F', 'G', 'H'],
        'rows' => [1, 2, 3],
    ],
    [
        'keywords' => ['北西', '北西側', '北西部', '北西方面', '北西エリア', '左上', '左上側', '左上部'],
        'cols' => ['A', 'B', 'C', 'D'],
        'rows' => [1, 2, 3],
    ],
    [
        'keywords' => ['南東', '南東側', '南東部', '南東方面', '南東エリア', '右下', '右下側', '右下部'],
        'cols' => ['E', 'F', 'G', 'H'],
        'rows' => [6, 7, 8],
    ],
    [
        'keywords' => ['南西', '南西側', '南西部', '南西方面', '南西エリア', '左下', '左下側', '左下部'],
        'cols' => ['A', 'B', 'C', 'D'],
        'rows' => [6, 7, 8],
    ],

    [
        'keywords' => [
            '北側', '北部', '北のほう', '北の方', '上のほう', '上の方', '上側',
            '上部', '上エリア', '北方面', '北エリア', '北寄り', '上寄り',
            '北一帯', '上半分', '北周辺', '北付近', '北あたり', '北近辺'
        ],
        'cols' => ['B', 'C', 'D', 'E', 'F', 'G'],
        'rows' => [1, 2, 3],
    ],
    [
        'keywords' => [
            '南側', '南部', '南のほう', '南の方', '下のほう', '下の方', '下側',
            '下部', '下エリア', '南方面', '南エリア', '南寄り', '下寄り',
            '南一帯', '下半分', '南周辺', '南付近', '南あたり', '南近辺'
        ],
        'cols' => ['B', 'C', 'D', 'E', 'F', 'G'],
        'rows' => [6, 7, 8],
    ],
    [
        'keywords' => [
            '東側', '東部', '右のほう', '右の方', '右側', '東', '右寄り',
            '東方面', '東エリア', '東一帯', '右半分', '東周辺', '東付近',
            '東あたり', '東近辺'
        ],
        'cols' => ['F', 'G', 'H'],
        'rows' => [2, 3, 4, 5, 6, 7],
    ],
    [
        'keywords' => [
            '西側', '西部', '左のほう', '左の方', '左側', '西', '左寄り',
            '西方面', '西エリア', '西一帯', '左半分', '西周辺', '西付近',
            '西あたり', '西近辺'
        ],
        'cols' => ['A', 'B', 'C'],
        'rows' => [2, 3, 4, 5, 6, 7],
    ],

    [
        'keywords' => [
            '中央', '中央付近', 'マップ中央', '中心', '中央部', '中央あたり',
            '中央近辺', '中央周辺', '中央一帯', 'ど真ん中', '真ん中', '中ほど',
            '中程', '中間', '中央エリア'
        ],
        'cols' => ['C', 'D', 'E', 'F'],
        'rows' => [3, 4, 5, 6],
    ],
    [
        'keywords' => ['中腹', '山の中腹', '途中', '中段'],
        'cols' => ['C', 'D', 'E', 'F'],
        'rows' => [3, 4, 5],
    ],
    [
        'keywords' => [
            '全域', '広範囲', '全体', '全体的', '一帯', '各地', '各所',
            '広い範囲', '広く分布', '広く生息', 'マップ全域', 'ほぼ全域'
        ],
        'cols' => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        'rows' => [1, 2, 3, 4, 5, 6, 7, 8],
    ],
];

        foreach ($directionPatterns as $pattern) {
            foreach ($pattern['keywords'] as $keyword) {
                if (mb_strpos($text, $keyword) !== false) {
                    $matched = array_merge($matched, $this->buildCoords($pattern['cols'], $pattern['rows']));
                    break;
                }
            }
        }

        $namedHints = [
            '橋の近く' => ['D4', 'E4', 'D5', 'E5'],
            '洞くつの近く' => ['C5', 'D5', 'C6', 'D6'],
            '村の近く' => ['E2', 'F2', 'E3', 'F3'],
            '入口付近' => ['D7', 'E7', 'D8', 'E8'],
            '出口付近' => ['D1', 'E1', 'D2', 'E2'],
            '通路沿い' => ['D3', 'D4', 'D5', 'E3', 'E4', 'E5'],
            '外周' => [
                'A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1',
                'A8', 'B8', 'C8', 'D8', 'E8', 'F8', 'G8', 'H8',
                'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
                'H2', 'H3', 'H4', 'H5', 'H6', 'H7',
            ],
            'たくさん' => ['C3', 'C4', 'C5', 'D3', 'D4', 'D5', 'E3', 'E4', 'E5', 'F3', 'F4', 'F5'],
        ];

        foreach ($namedHints as $keyword => $coords) {
            if (mb_strpos($text, $keyword) !== false) {
                $matched = array_merge($matched, $coords);
            }
        }

        $matched = array_values(array_unique($matched));
        sort($matched);

        if (count($matched) > 0) {
            return $matched;
        }

        return [];
    }

    private function buildCoords(array $cols, array $rows): array
    {
        $coords = [];

        foreach ($cols as $col) {
            foreach ($rows as $row) {
                $coords[] = $col . $row;
            }
        }

        return $coords;
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

    private function detectContinentKeyFromListUrl(string $listUrl): string
    {
        $url = strtolower($listUrl);

        if (str_contains($url, '1-augu.php')) {
            return 'orgreed';
        }

        if (str_contains($url, '1-puku.php')) {
            return 'pukuland';
        }

        if (str_contains($url, '1-eltona.php')) {
            return 'eltona';
        }

        if (str_contains($url, '1-wena.php')) {
            return 'wena';
        }

        if (str_contains($url, '1-dowa.php')) {
            return 'dwachakka';
        }

        if (str_contains($url, '1-sonota.php')) {
            return 'sonota';
        }

        if (str_contains($url, '1-itsuwari.php')) {
            return 'itsuwari';
        }

        if (str_contains($url, '1-shin.php')) {
            return 'shin';
        }

        if (str_contains($url, '1-nadora.php')) {
            return 'nadora';
        }

        if (str_contains($url, '1-kyuru.php')) {
            return 'kyururu';
        }

        if (str_contains($url, '1-makai.php')) {
            return 'makai';
        }

        if (str_contains($url, '1-tensei.php')) {
            return 'tensei';
        }

        if (str_contains($url, '1-hate.php')) {
            return 'hate';
        }

        return 'other';
    }

    private function buildMapImageFileName(string $continentKey, int $mapId, string $ext = 'jpg'): string
    {
        $continentKey = preg_replace('/[^a-z0-9_-]/', '', strtolower($continentKey)) ?: 'other';
        $ext = preg_replace('/[^a-z0-9]/', '', strtolower($ext)) ?: 'jpg';

        return $continentKey . '_' . $mapId . '.' . $ext;
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
