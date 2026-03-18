<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ImportDraquexMonsterLayerSpawns extends Command
{
    protected $signature = 'dq10:import-draquex-monster-layer-spawns
                            {list_url?* : 50音一覧URLを複数指定可能。未指定なら全行を巡回}
                            {--dry-run : DB更新をしない}
                            {--monster= : 特定モンスター名だけ対象にする}
                            {--map= : 特定マップ名だけ対象にする}
                            {--limit= : モンスター処理件数の上限}';

    protected $description = 'Draquex の50音モンスター一覧から詳細ページを巡回し、既存 map_layers にだけ紐づけて monster_map_spawns を更新する';

    private string $missingGroundCsvPath = '';
    private $missingGroundCsvHandle = null;
    private int $missingGroundCsvCount = 0;

    public function handle(): int
    {
        $this->warn('ImportDraquexMonsterLayerSpawns running');

        $dryRun = (bool) $this->option('dry-run');
        $onlyMonster = trim((string) $this->option('monster'));
        $onlyMap = trim((string) $this->option('map'));
        $limit = $this->option('limit');

        $this->prepareMissingGroundCsv();

        $listUrls = $this->getTargetListUrls();

        $this->info('対象一覧URL数: ' . count($listUrls));
        foreach ($listUrls as $url) {
            $this->line(' - ' . $url);
        }

        $monsterLinks = [];

        foreach ($listUrls as $listUrl) {
            $this->newLine();
            $this->info("一覧取得: {$listUrl}");

            $html = $this->fetch($listUrl);
            if (! $html) {
                $this->warn("一覧取得失敗: {$listUrl}");
                continue;
            }

            $rows = $this->extractMonsterLinksFromListPage($html, $listUrl);

            foreach ($rows as $row) {
                $monsterLinks[] = $row;
            }
        }

        $monsterLinks = $this->uniqueMonsterLinks($monsterLinks);

        if ($onlyMonster !== '') {
            $monsterLinks = array_values(array_filter($monsterLinks, function ($row) use ($onlyMonster) {
                return $this->normalizeMonsterName($row['monster']) === $this->normalizeMonsterName($onlyMonster);
            }));
        }

        if ($limit !== null && $limit !== '') {
            $monsterLinks = array_slice($monsterLinks, 0, (int) $limit);
        }

        $this->newLine();
        $this->info('対象モンスター数: ' . count($monsterLinks));
        foreach (array_slice($monsterLinks, 0, 20) as $row) {
            $this->line(" - {$row['monster']} => {$row['url']}");
        }

        if (empty($monsterLinks)) {
            $this->warn('対象モンスターが 0 件');
            $this->closeMissingGroundCsv();
            return self::SUCCESS;
        }

        $processedMonster = 0;
        $updatedSpawn = 0;
        $insertedSpawn = 0;
        $skippedMonster = 0;
        $skippedMap = 0;
        $fallbackGroundUsed = 0;
        $skippedNoGroundLayer = 0;

        foreach ($monsterLinks as $monsterRow) {
            $monsterName = $this->normalizeMonsterName($monsterRow['monster']);
            $detailUrl = $monsterRow['url'];

            $this->newLine();
            $this->info("MONSTER: {$monsterName}");
            $this->line("URL: {$detailUrl}");

            $monster = DB::table('monsters')
                ->where('name', $monsterName)
                ->first();

            if (! $monster) {
                $this->warn("  monsters 未登録: {$monsterName}");
                $skippedMonster++;
                continue;
            }

            $detailHtml = $this->fetch($detailUrl);
            if (! $detailHtml) {
                $this->warn("  詳細取得失敗: {$detailUrl}");
                continue;
            }

            $regionRows = $this->extractRegionRowsFromMonsterDetailPage($detailHtml);

            if (empty($regionRows)) {
                $this->warn('  地域情報なし');
                continue;
            }

            foreach ($regionRows as $regionRow) {
                $mapName = $this->normalizeMapName($regionRow['map']);
                $noteText = $this->normalizeNoteText($regionRow['note']);

                if ($mapName === '') {
                    continue;
                }

                if ($onlyMap !== '' && $this->normalizeMapName($onlyMap) !== $mapName) {
                    continue;
                }

                $map = DB::table('maps')
                    ->where('name', $mapName)
                    ->first();

                if (! $map) {
                    $this->warn("  maps 未登録: {$mapName}");
                    $skippedMap++;
                    continue;
                }

                $spawnTime = $this->detectSpawnTime($noteText);
                $coords = $this->extractCoords($noteText);

                if (empty($coords)) {
                    $coords = $this->inferCoordsFromText($noteText);
                }

                $this->line("  MAP: {$mapName}");
                $this->line("  NOTE: {$noteText}");

                $mapLayers = $this->getMapLayersForMap((int) $map->id);

                $matchedLayers = $this->resolveMatchedLayers(
                    mapId: (int) $map->id,
                    noteText: $noteText,
                    mapLayers: $mapLayers
                );

                $targetLayers = [];

                if ($matchedLayers->isEmpty()) {
                    $groundLayer = $this->findGroundMapLayerFromCollection($mapLayers);

                    if (! $groundLayer) {
                        $this->warn("  地上レイヤーなし: {$mapName}");

                        $this->appendMissingGroundCsv([
                            'monster_id' => (int) $monster->id,
                            'monster_name' => (string) $monster->name,
                            'map_id' => (int) $map->id,
                            'map_name' => (string) $map->name,
                            'requested_layer_name' => '',
                            'spawn_time' => $spawnTime,
                            'coords' => json_encode($coords, JSON_UNESCAPED_UNICODE),
                            'note' => $noteText,
                            'source_url' => $detailUrl,
                        ]);

                        $skippedNoGroundLayer++;
                        continue;
                    }

                    $targetLayers[$groundLayer->id] = $groundLayer;
                    $fallbackGroundUsed++;
                    $this->line("  layer 判定なし → 地上へ補完: {$groundLayer->id} / {$groundLayer->layer_name}");
                } else {
                    foreach ($matchedLayers as $matchedLayer) {
                        $targetLayers[$matchedLayer->id] = $matchedLayer;
                    }
                }

                foreach ($targetLayers as $layer) {
                    if ($dryRun) {
                        $this->line("  [dry-run] map_layer 使用: {$layer->id} / {$layer->layer_name}");
                    }

                    $result = $this->upsertMonsterMapSpawn(
                        monsterId: (int) $monster->id,
                        mapId: (int) $map->id,
                        mapLayerId: (int) $layer->id,
                        spawnTime: $spawnTime,
                        coords: $coords,
                        noteText: $noteText,
                        dryRun: $dryRun
                    );

                    if ($result === 'inserted') {
                        $insertedSpawn++;
                        $this->line("  spawn 追加: monster_id={$monster->id} map_id={$map->id} layer_id={$layer->id}");
                    } elseif ($result === 'updated') {
                        $updatedSpawn++;
                        $this->line("  spawn 更新: monster_id={$monster->id} map_id={$map->id} layer_id={$layer->id}");
                    } elseif ($result === 'dry-run') {
                        $this->line("  [dry-run] spawn 更新予定: monster_id={$monster->id} map_id={$map->id} layer_id={$layer->id}");
                    }
                }
            }

            $processedMonster++;
        }

        $this->closeMissingGroundCsv();

        $this->newLine();
        $this->info(sprintf(
            '完了 processed_monster=%d inserted_spawn=%d updated_spawn=%d skipped_monster=%d skipped_map=%d fallback_ground_used=%d skipped_no_ground_layer=%d missing_ground_csv_count=%d',
            $processedMonster,
            $insertedSpawn,
            $updatedSpawn,
            $skippedMonster,
            $skippedMap,
            $fallbackGroundUsed,
            $skippedNoGroundLayer,
            $this->missingGroundCsvCount
        ));

        if ($this->missingGroundCsvCount > 0) {
            $this->info('CSV: ' . $this->missingGroundCsvPath);
        }

        return self::SUCCESS;
    }

    private function prepareMissingGroundCsv(): void
    {
        $dir = storage_path('app/reports');

        if (! is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $this->missingGroundCsvPath = $dir . '/draquex_missing_ground_layers_' . now()->format('Ymd_His') . '.csv';
        $this->missingGroundCsvHandle = fopen($this->missingGroundCsvPath, 'w');

        if ($this->missingGroundCsvHandle === false) {
            throw new \RuntimeException('CSVファイルを作成できない: ' . $this->missingGroundCsvPath);
        }

        fputcsv($this->missingGroundCsvHandle, [
            'monster_id',
            'monster_name',
            'map_id',
            'map_name',
            'requested_layer_name',
            'spawn_time',
            'coords',
            'note',
            'source_url',
        ]);
    }

    private function appendMissingGroundCsv(array $row): void
    {
        if (! $this->missingGroundCsvHandle) {
            return;
        }

        fputcsv($this->missingGroundCsvHandle, [
            $row['monster_id'] ?? '',
            $row['monster_name'] ?? '',
            $row['map_id'] ?? '',
            $row['map_name'] ?? '',
            $row['requested_layer_name'] ?? '',
            $row['spawn_time'] ?? '',
            $row['coords'] ?? '',
            $row['note'] ?? '',
            $row['source_url'] ?? '',
        ]);

        $this->missingGroundCsvCount++;
    }

    private function closeMissingGroundCsv(): void
    {
        if ($this->missingGroundCsvHandle) {
            fclose($this->missingGroundCsvHandle);
            $this->missingGroundCsvHandle = null;
        }
    }

    private function getTargetListUrls(): array
    {
        $inputUrls = $this->argument('list_url');

        if (is_array($inputUrls) && count($inputUrls) > 0) {
            return array_values(array_unique(array_filter(array_map('trim', $inputUrls))));
        }

        return [
            'https://draquex.com/monster/field/0-a-gyou.php',
            'https://draquex.com/monster/field/0-ka-gyou.php',
            'https://draquex.com/monster/field/0-sa-gyou.php',
            'https://draquex.com/monster/field/0-ta-gyou.php',
            'https://draquex.com/monster/field/0-na-gyou.php',
            'https://draquex.com/monster/field/0-ha-gyou.php',
            'https://draquex.com/monster/field/0-ma-gyou.php',
            'https://draquex.com/monster/field/0-ya-gyou.php',
            'https://draquex.com/monster/field/0-ra-gyou.php',
            'https://draquex.com/monster/field/0-wa-gyou.php',
        ];
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

    private function extractMonsterLinksFromListPage(string $html, string $baseUrl): array
    {
        $xpath = $this->makeXPath($html);
        $rows = [];

        foreach ($xpath->query('//a[@href]') as $a) {
            $href = trim($a->getAttribute('href'));
            if ($href === '') {
                continue;
            }

            if (! preg_match('#(?:^|/)(?:mon-\d+|[a-z]+-\d+)\.php$#i', $href)) {
                continue;
            }

            $name = '';
            $nameNode = $xpath->query('.//*[contains(@class, "name")]', $a)->item(0);

            if ($nameNode) {
                $name = trim(preg_replace('/\s+/u', ' ', $nameNode->textContent));
            } else {
                $name = trim(preg_replace('/\s+/u', ' ', $a->textContent));
            }

            $name = preg_replace('/\s*\(.*?\)\s*/u', '', $name);
            $name = preg_replace('/（.*?）/u', '', $name);
            $name = $this->normalizeMonsterName($name);

            if ($name === '') {
                continue;
            }

            $rows[] = [
                'monster' => $name,
                'url' => $this->absoluteUrl($baseUrl, $href),
            ];
        }

        return $rows;
    }

    private function extractRegionRowsFromMonsterDetailPage(string $html): array
    {
        $xpath = $this->makeXPath($html);
        $rows = [];

        foreach ($xpath->query('//section') as $section) {
            $h2 = $xpath->query('.//h2', $section)->item(0);

            if (! $h2) {
                continue;
            }

            $title = trim(preg_replace('/\s+/u', ' ', $h2->textContent));

            if (mb_strpos($title, 'どのあたりにいるか') === false) {
                continue;
            }

            foreach ($xpath->query('.//table//tr', $section) as $tr) {
                $tds = $tr->getElementsByTagName('td');

                if ($tds->length < 2) {
                    continue;
                }

                $map = trim(preg_replace('/\s+/u', ' ', $tds->item(0)->textContent));
                $note = trim(preg_replace('/\s+/u', ' ', $tds->item(1)->textContent));

                $map = preg_replace('/\s*\(.*?\)\s*/u', '', $map);
                $map = preg_replace('/（.*?）/u', '', $map);
                $map = $this->normalizeMapName($map);

                if ($map === '' || $note === '') {
                    continue;
                }

                $rows[] = [
                    'map' => $map,
                    'note' => $note,
                ];
            }
        }

        return $rows;
    }

    private function resolveMatchedLayers(int $mapId, string $noteText, Collection $mapLayers): Collection
    {
        $matched = collect();

        $genericCandidates = $this->resolveGenericLayerCandidatesFromText($noteText);

        foreach ($genericCandidates as $candidate) {
            $layer = $this->findBestMapLayerByRequestedName(
                mapLayers: $mapLayers,
                requestedLayerName: $candidate['layer_name']
            );

            if ($layer) {
                $matched->put($layer->id, $layer);
            }
        }

        $dbLayerMatched = $this->findMapLayerByLayerNamesFromDb(
            mapLayers: $mapLayers,
            noteText: $noteText
        );

        if ($dbLayerMatched) {
            $matched->put($dbLayerMatched->id, $dbLayerMatched);
        }

        return $matched->values();
    }

    private function resolveGenericLayerCandidatesFromText(string $text): array
    {
        $text = trim($text);
        $layers = [];

        if (mb_strpos($text, '地上') !== false || preg_match('/(?<!地下)1\s*階/u', $text)) {
            $layers[] = ['layer_name' => '地上', 'display_order' => 1, 'floor_no' => 1];
        }

        if (preg_match_all('/地下\s*([1-7])\s*階/u', $text, $m, PREG_SET_ORDER)) {
            foreach ($m as $match) {
                $layers[] = [
                    'layer_name' => '地下' . (int) $match[1] . '階',
                    'display_order' => (int) $match[1],
                    'floor_no' => -1 * (int) $match[1],
                ];
            }
        }

        if (preg_match_all('/(?<!地下)([2-9])\s*階/u', $text, $m, PREG_SET_ORDER)) {
            foreach ($m as $match) {
                $n = (int) $match[1];
                $layers[] = [
                    'layer_name' => $n . '階',
                    'display_order' => $n,
                    'floor_no' => $n,
                ];
            }
        }

        if (preg_match_all('/第([一二三四五六七])層/u', $text, $m, PREG_SET_ORDER)) {
            foreach ($m as $match) {
                $layers[] = [
                    'layer_name' => '第' . $match[1] . '層',
                    'display_order' => $this->kanjiLayerOrder($match[1]),
                    'floor_no' => $this->kanjiLayerOrder($match[1]),
                ];
            }
        }

        if (preg_match_all('/第([1-7])層/u', $text, $m, PREG_SET_ORDER)) {
            foreach ($m as $match) {
                $n = (int) $match[1];
                $layers[] = [
                    'layer_name' => '第' . $n . '層',
                    'display_order' => $n,
                    'floor_no' => $n,
                ];
            }
        }

        foreach (['上層', '中層', '下層', '中央', '中央部', '内部'] as $label) {
            if (mb_strpos($text, $label) !== false) {
                $layers[] = [
                    'layer_name' => $label,
                    'display_order' => 1,
                    'floor_no' => 1,
                ];
            }
        }

        $unique = [];
        $result = [];

        foreach ($layers as $layer) {
            $key = $layer['layer_name'];

            if (in_array($key, ['地上', '1階'], true)) {
                $key = 'ground_or_1f';
            }

            if (in_array($key, ['中央', '中央部'], true)) {
                $key = 'center_or_center_part';
            }

            if (isset($unique[$key])) {
                continue;
            }

            $unique[$key] = true;
            $result[] = $layer;
        }

        usort($result, function ($a, $b) {
            if (($a['display_order'] ?? 0) !== ($b['display_order'] ?? 0)) {
                return ($a['display_order'] ?? 0) <=> ($b['display_order'] ?? 0);
            }

            if (($a['floor_no'] ?? 0) !== ($b['floor_no'] ?? 0)) {
                return ($a['floor_no'] ?? 0) <=> ($b['floor_no'] ?? 0);
            }

            return strcmp($a['layer_name'], $b['layer_name']);
        });

        return $result;
    }

    private function findBestMapLayerByRequestedName(Collection $mapLayers, string $requestedLayerName): ?object
    {
        $requestedLayerName = trim($requestedLayerName);

        $equivalentNames = $this->getEquivalentLayerNames($requestedLayerName);

        $exact = $mapLayers
            ->filter(function ($layer) use ($equivalentNames) {
                return in_array((string) $layer->layer_name, $equivalentNames, true);
            })
            ->sortBy(function ($layer) {
                return $this->layerPriorityForSorting((string) $layer->layer_name);
            })
            ->first();

        if ($exact) {
            return $exact;
        }

        $containsKeywords = $this->getLayerContainsKeywords($requestedLayerName);

        if (empty($containsKeywords)) {
            return null;
        }

        $matched = $mapLayers
            ->map(function ($layer) use ($containsKeywords) {
                $score = 0;
                $layerName = (string) $layer->layer_name;

                foreach ($containsKeywords as $keyword) {
                    if ($keyword !== '' && mb_strpos($layerName, $keyword) !== false) {
                        $score = max($score, mb_strlen($keyword));
                    }
                }

                return [
                    'layer' => $layer,
                    'score' => $score,
                    'priority' => $this->layerPriorityForSorting($layerName),
                ];
            })
            ->filter(fn ($row) => $row['score'] > 0)
            ->sort(function ($a, $b) {
                if ($a['score'] !== $b['score']) {
                    return $b['score'] <=> $a['score'];
                }

                if ($a['priority'] !== $b['priority']) {
                    return $a['priority'] <=> $b['priority'];
                }

                return (int) $a['layer']->id <=> (int) $b['layer']->id;
            })
            ->first();

        return $matched['layer'] ?? null;
    }

    private function findMapLayerByLayerNamesFromDb(Collection $mapLayers, string $noteText): ?object
    {
        if ($mapLayers->isEmpty()) {
            return null;
        }

        $noteText = trim($noteText);

        $scored = $mapLayers
            ->map(function ($layer) use ($noteText) {
                $score = $this->scoreLayerNameMatch((string) $layer->layer_name, $noteText);

                return [
                    'layer' => $layer,
                    'score' => $score,
                    'priority' => $this->layerPriorityForSorting((string) $layer->layer_name),
                ];
            })
            ->filter(fn ($row) => $row['score'] > 0)
            ->sort(function ($a, $b) {
                if ($a['score'] !== $b['score']) {
                    return $b['score'] <=> $a['score'];
                }

                if ($a['priority'] !== $b['priority']) {
                    return $a['priority'] <=> $b['priority'];
                }

                return (int) $a['layer']->id <=> (int) $b['layer']->id;
            })
            ->values();

        return $scored->first()['layer'] ?? null;
    }

    private function scoreLayerNameMatch(string $layerName, string $noteText): int
    {
        $layerName = trim($layerName);
        $noteText = trim($noteText);

        if ($layerName === '' || $noteText === '') {
            return 0;
        }

        $keywords = $this->buildLayerKeywordsFromLayerName($layerName);

        $bestScore = 0;

        foreach ($keywords as $keyword) {
            if ($keyword === '') {
                continue;
            }

            if (mb_strpos($noteText, $keyword) !== false) {
                $score = mb_strlen($keyword);

                if ($keyword === $layerName) {
                    $score += 100;
                } elseif (mb_strpos($layerName, $keyword) !== false) {
                    $score += 20;
                }

                $bestScore = max($bestScore, $score);
            }
        }

        return $bestScore;
    }

    private function buildLayerKeywordsFromLayerName(string $layerName): array
    {
        $layerName = trim($layerName);
        $keywords = [$layerName];

        if ($layerName === '地上' || $layerName === '1階') {
            $keywords[] = '地上';
            $keywords[] = '1階';
        }

        if (mb_strpos($layerName, '中央部') !== false) {
            $keywords[] = '中央部';
            $keywords[] = '中央';
        } elseif (mb_strpos($layerName, '中央') !== false) {
            $keywords[] = '中央';
        }

        if (mb_strpos($layerName, '内部') !== false) {
            $keywords[] = '内部';
        }

        foreach (['上層', '中層', '下層'] as $word) {
            if (mb_strpos($layerName, $word) !== false) {
                $keywords[] = $word;
            }
        }

        if (preg_match('/地下\s*([1-7])\s*階/u', $layerName, $m)) {
            $keywords[] = '地下' . (int) $m[1] . '階';
        }

        if (preg_match('/(?<!地下)([1-9])\s*階/u', $layerName, $m)) {
            $keywords[] = (int) $m[1] . '階';
        }

        if (preg_match('/第([一二三四五六七])層/u', $layerName, $m)) {
            $keywords[] = '第' . $m[1] . '層';
        }

        if (preg_match('/第([1-7])層/u', $layerName, $m)) {
            $keywords[] = '第' . (int) $m[1] . '層';
        }

        if (mb_strpos($layerName, 'の') !== false) {
            $parts = array_filter(array_map('trim', preg_split('/の/u', $layerName)));
            foreach ($parts as $part) {
                if ($part !== '') {
                    $keywords[] = $part;
                }
            }
        }

        if (mb_strlen($layerName) >= 4) {
            $keywords[] = preg_replace('/\s+/u', '', $layerName);
        }

        $keywords = array_values(array_unique(array_filter($keywords, fn ($v) => trim((string) $v) !== '')));

        usort($keywords, function ($a, $b) {
            return mb_strlen($b) <=> mb_strlen($a);
        });

        return $keywords;
    }

    private function getLayerContainsKeywords(string $requestedLayerName): array
    {
        $requestedLayerName = trim($requestedLayerName);

        return match ($requestedLayerName) {
            '中央', '中央部' => ['中央部', '中央'],
            '内部' => ['内部'],
            '上層' => ['上層'],
            '中層' => ['中層'],
            '下層' => ['下層'],
            '第一層', '第1層' => ['第一層', '第1層'],
            '第二層', '第2層' => ['第二層', '第2層'],
            '第三層', '第3層' => ['第三層', '第3層'],
            '第四層', '第4層' => ['第四層', '第4層'],
            '第五層', '第5層' => ['第五層', '第5層'],
            '第六層', '第6層' => ['第六層', '第6層'],
            '第七層', '第7層' => ['第七層', '第7層'],
            default => [$requestedLayerName],
        };
    }

    private function getEquivalentLayerNames(string $layerName): array
    {
        $layerName = trim($layerName);

        if ($layerName === '地上' || $layerName === '1階') {
            return ['地上', '1階'];
        }

        if ($layerName === '中央' || $layerName === '中央部') {
            return ['中央', '中央部'];
        }

        return [$layerName];
    }

    private function getMapLayersForMap(int $mapId): Collection
    {
        return DB::table('map_layers')
            ->where('map_id', $mapId)
            ->orderBy('display_order')
            ->orderBy('floor_no')
            ->orderBy('id')
            ->get();
    }

    private function findGroundMapLayerFromCollection(Collection $mapLayers): ?object
    {
        return $mapLayers
            ->filter(fn ($layer) => in_array((string) $layer->layer_name, ['地上', '1階'], true))
            ->sortBy(function ($layer) {
                return $this->layerPriorityForSorting((string) $layer->layer_name);
            })
            ->first();
    }

    private function layerPriorityForSorting(string $layerName): int
    {
        return match ($layerName) {
            '地上' => 0,
            '1階' => 1,
            '中央部' => 2,
            '中央' => 3,
            default => 10,
        };
    }

    private function kanjiLayerOrder(string $kanji): int
    {
        return match ($kanji) {
            '一' => 1,
            '二' => 2,
            '三' => 3,
            '四' => 4,
            '五' => 5,
            '六' => 6,
            '七' => 7,
            default => 1,
        };
    }

    private function upsertMonsterMapSpawn(
        int $monsterId,
        int $mapId,
        int $mapLayerId,
        string $spawnTime,
        array $coords,
        string $noteText,
        bool $dryRun = false
    ): string {
        $existing = DB::table('monster_map_spawns')
            ->where('monster_id', $monsterId)
            ->where('map_id', $mapId)
            ->where('map_layer_id', $mapLayerId)
            ->where('spawn_time', $spawnTime)
            ->first();

        if ($dryRun) {
            return 'dry-run';
        }

        if ($existing) {
            $existingArea = $this->decodeJsonArray($existing->area ?? null);
            $mergedArea = $this->mergeStringArrays($existingArea, $coords);

            $existingNote = $this->decodeJsonArray($existing->note ?? null);
            $mergedNote = $this->mergeStringArrays($existingNote, [$noteText]);

            DB::table('monster_map_spawns')
                ->where('id', $existing->id)
                ->update([
                    'area' => ! empty($mergedArea) ? json_encode($mergedArea, JSON_UNESCAPED_UNICODE) : null,
                    'note' => ! empty($mergedNote) ? json_encode($mergedNote, JSON_UNESCAPED_UNICODE) : null,
                    'updated_at' => now(),
                ]);

            return 'updated';
        }

        DB::table('monster_map_spawns')->insert([
            'monster_id' => $monsterId,
            'map_id' => $mapId,
            'map_layer_id' => $mapLayerId,
            'area' => ! empty($coords) ? json_encode($coords, JSON_UNESCAPED_UNICODE) : null,
            'spawn_time' => $spawnTime,
            'note' => json_encode([$noteText], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return 'inserted';
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
        sort($coords);

        return $coords;
    }

    private function inferCoordsFromText(string $text): array
    {
        $matched = [];

        $patterns = [
            [['北東', '北東側', '右上'], ['E', 'F', 'G', 'H'], [1, 2, 3]],
            [['北西', '北西側', '左上'], ['A', 'B', 'C', 'D'], [1, 2, 3]],
            [['南東', '南東側', '右下'], ['E', 'F', 'G', 'H'], [6, 7, 8]],
            [['南西', '南西側', '左下'], ['A', 'B', 'C', 'D'], [6, 7, 8]],
            [['中央', '中央付近', '中心', '真ん中'], ['C', 'D', 'E', 'F'], [3, 4, 5, 6]],
            [['通路'], ['D', 'E'], [2, 3, 4, 5, 6, 7]],
            [['外側'], ['A', 'B', 'G', 'H'], [2, 3, 4, 5, 6, 7]],
            [['外周'], ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], [1, 8]],
        ];

        foreach ($patterns as [$keywords, $cols, $rows]) {
            foreach ($keywords as $keyword) {
                if (mb_strpos($text, $keyword) !== false) {
                    $matched = array_merge($matched, $this->buildCoords($cols, $rows));
                    break;
                }
            }
        }

        $matched = array_values(array_unique($matched));
        sort($matched);

        return $matched;
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
        $name = preg_replace('/\s*\(.*?\)\s*/u', '', $name);
        $name = preg_replace('/（.*?）/u', '', $name);

        return trim($name);
    }

    private function normalizeNoteText(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', $text));
    }

    private function uniqueMonsterLinks(array $items): array
    {
        $seen = [];
        $result = [];

        foreach ($items as $item) {
            $key = ($item['monster'] ?? '') . '|' . ($item['url'] ?? '');

            if ($key === '|') {
                continue;
            }

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $result[] = $item;
        }

        return $result;
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

    private function decodeJsonArray($value): array
    {
        if ($value === null) {
            return [];
        }

        if (is_array($value)) {
            return array_values(array_filter(array_map(fn ($v) => trim((string) $v), $value), fn ($v) => $v !== ''));
        }

        $value = trim((string) $value);

        if ($value === '' || $value === 'null') {
            return [];
        }

        $decoded = json_decode($value, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return array_values(array_filter(array_map(fn ($v) => trim((string) $v), $decoded), fn ($v) => $v !== ''));
        }

        return [$value];
    }

    private function mergeStringArrays(array $base, array $extra): array
    {
        $merged = array_merge($base, $extra);
        $merged = array_map(fn ($v) => trim((string) $v), $merged);
        $merged = array_filter($merged, fn ($v) => $v !== '');
        $merged = array_values(array_unique($merged));
        sort($merged);

        return $merged;
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