<?php

namespace App\Console\Commands;

use App\Models\Map;
use App\Models\MapLayer;
use App\Models\Monster;
use App\Models\MonsterMapSpawn;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\DomCrawler\Crawler;
use Throwable;

class ImportMonsterMapSpawnsFromDqWiki extends Command
{
    protected $signature = 'dqx:import-monster-map-spawns
        {--pages=1,2 : 図鑑ページ番号をカンマ区切りで指定}
        {--monster= : 特定モンスター名だけ試す}
        {--refresh : 既存データの spawn 系情報も更新する}
        {--dry-run : DB更新せずログだけ出す}
    ';

    protected $description = 'DQ10 100匹討伐隊wiki から monster_map_spawns を取り込む';

    protected string $baseUrl = 'https://dq100buster.wiki.fc2.com';

    protected array $unresolvedLayerRows = [];

    public function handle(): int
    {
        $pages = collect(explode(',', (string) $this->option('pages')))
            ->map(fn ($v) => trim($v))
            ->filter(fn ($v) => $v !== '')
            ->map(fn ($v) => (int) $v)
            ->values();

        $monsterOnly = $this->option('monster');
        $refresh = (bool) $this->option('refresh');
        $dryRun = (bool) $this->option('dry-run');

        $monsterLinks = collect();

        foreach ($pages as $pageNo) {
            $url = $this->buildZukanPageUrl($pageNo);

            $this->line("==== 図鑑ページ取得 page={$pageNo} url={$url}");

            try {
                $html = $this->fetchHtml($url);
                $links = $this->extractMonsterLinksFromZukanPage($html);

                $this->info("page={$pageNo} で " . $links->count() . " 件のモンスターリンクを検出");

                $monsterLinks = $monsterLinks->merge($links);
            } catch (Throwable $e) {
                $this->error("図鑑ページ取得失敗 page={$pageNo}: {$e->getMessage()}");
            }
        }

        $monsterLinks = $monsterLinks
            ->unique('url')
            ->values();

        if ($monsterOnly) {
            $monsterLinks = $monsterLinks->filter(function ($row) use ($monsterOnly) {
                return Str::contains($row['name'], $monsterOnly);
            })->values();
        }

        $this->info("対象モンスター数: " . $monsterLinks->count());

        $totalCreated = 0;
        $totalUpdated = 0;
        $totalSkipped = 0;
        $totalUnresolvedLayer = 0;

        foreach ($monsterLinks as $monsterLink) {
            $monsterName = $monsterLink['name'];
            $monsterUrl = $monsterLink['url'];

            $this->newLine();
            $this->line("---- モンスター処理開始: {$monsterName}");
            $this->line("URL: {$monsterUrl}");

            /** @var Monster|null $monster */
            $monster = Monster::query()
                ->where('name', $monsterName)
                ->first();

            if (! $monster) {
                $this->warn("[SKIP] monsters に未登録: {$monsterName}");
                $totalSkipped++;
                continue;
            }

            try {
                $html = $this->fetchHtml($monsterUrl);
                $spawns = $this->extractSpawnRowsFromMonsterPage($html);

                if ($spawns->isEmpty()) {
                    $this->warn("[SKIP] 出現テーブルなし: {$monsterName}");
                    $totalSkipped++;
                    continue;
                }

                foreach ($spawns as $spawn) {
                    $mapName = $spawn['map_name'];
                    $note = $spawn['note'];
                    $version = $spawn['version'];
                    $spawnTime = $spawn['spawn_time'];
                    $spawnCount = $spawn['spawn_count'];
                    $symbolCount = $spawn['symbol_count'];
                    $pageSection = $spawn['section'];

                    /** @var Map|null $map */
                    $map = Map::query()
                        ->where('name', $mapName)
                        ->first();

                    if ($map) {
                        $this->line("[MAP解決] FOUND map_id={$map->id} / name={$map->name}");
                    } else {
                        $this->warn("[MAP解決] NOT_FOUND input_name={$mapName} / monster={$monsterName}");
                        $totalSkipped++;
                        continue;
                    }

                    $layers = MapLayer::query()
                        ->where('map_id', $map->id)
                        ->orderBy('display_order')
                        ->orderBy('id')
                        ->get();

                    [$layer, $layerStatus] = $this->resolveLayerForSpawn($layers, $note);

                    if ($layer) {
                        $this->line(sprintf(
                            '[LAYER解決] %s layer_id=%d / layer_name=%s / floor_no=%s / text=%s',
                            strtoupper($layerStatus),
                            $layer->id,
                            $layer->layer_name ?? '',
                            $layer->floor_no,
                            $note
                        ));
                    } else {
                        $mapLayerNames = $layers
                            ->pluck('layer_name')
                            ->filter()
                            ->values()
                            ->implode(', ');

                        $this->warn(sprintf(
                            '[LAYER解決] NOT_FOUND map_id=%d / map_name=%s / layers=[%s] / text=%s',
                            $map->id,
                            $map->name,
                            $mapLayerNames,
                            $note
                        ));

                        $this->pushUnresolvedLayerRow([
                            'monster_id' => $monster->id,
                            'monster_name' => $monster->name,
                            'monster_url' => $monsterUrl,
                            'map_id' => $map->id,
                            'map_name' => $map->name,
                            'map_layer_candidates' => $mapLayerNames,
                            'section' => $pageSection,
                            'note' => $note,
                            'version' => $version,
                            'spawn_time' => $spawnTime ?: 'normal',
                            'spawn_count' => $spawnCount,
                            'symbol_count' => $symbolCount,
                            'reason' => $layers->isEmpty() ? 'map_layers_empty' : 'layer_not_matched',
                        ]);

                        $totalUnresolvedLayer++;
                        continue;
                    }

                    $payload = [
                        'monster_id'   => $monster->id,
                        'map_id'       => $map->id,
                        'map_layer_id' => $layer->id,
                        'area'         => null,
                        'spawn_time'   => $spawnTime ?: 'normal',
                        'spawn_count'  => $spawnCount,
                        'symbol_count' => $symbolCount,
                        'note'         => $this->buildFinalNote($note, $version),
                    ];

                    $existing = $this->findExistingSpawn(
                        monsterId: $monster->id,
                        mapId: $map->id,
                        layerId: $layer->id,
                        spawnTime: $payload['spawn_time']
                    );

                    if ($dryRun) {
                        $duplicateTarget = null;

                        if ($existing) {
                            $duplicateTarget = $this->findDuplicateTargetSpawn(
                                monsterId: $monster->id,
                                mapId: $map->id,
                                layerId: $layer->id,
                                spawnTime: $payload['spawn_time'],
                                excludeId: $existing->id
                            );
                        } else {
                            $duplicateTarget = $this->findDuplicateTargetSpawn(
                                monsterId: $monster->id,
                                mapId: $map->id,
                                layerId: $layer->id,
                                spawnTime: $payload['spawn_time']
                            );
                        }

                        if ($duplicateTarget) {
                            $this->comment('[DRY RUN][MERGE] ' . json_encode([
                                'target_id' => $duplicateTarget->id,
                                'monster_id' => $monster->id,
                                'map_id' => $map->id,
                                'map_layer_id' => $layer->id,
                                'spawn_time' => $payload['spawn_time'],
                                'note' => $this->appendNote($duplicateTarget->note, $payload['note']),
                                'spawn_count' => $refresh ? ($payload['spawn_count'] ?: $duplicateTarget->spawn_count) : $duplicateTarget->spawn_count,
                                'symbol_count' => $refresh ? ($payload['symbol_count'] ?: $duplicateTarget->symbol_count) : $duplicateTarget->symbol_count,
                            ], JSON_UNESCAPED_UNICODE));
                            continue;
                        }

                        if ($existing) {
                            $this->comment('[DRY RUN][UPDATE] ' . json_encode([
                                'id' => $existing->id,
                                'monster_id' => $monster->id,
                                'map_id' => $map->id,
                                'map_layer_id' => $layer->id,
                                'spawn_time' => $refresh ? ($payload['spawn_time'] ?: $existing->spawn_time) : $existing->spawn_time,
                                'spawn_count' => $refresh ? ($payload['spawn_count'] ?: $existing->spawn_count) : $existing->spawn_count,
                                'symbol_count' => $refresh ? ($payload['symbol_count'] ?: $existing->symbol_count) : $existing->symbol_count,
                                'note' => $this->appendNote($existing->note, $payload['note']),
                            ], JSON_UNESCAPED_UNICODE));
                        } else {
                            $this->comment('[DRY RUN][CREATE] ' . json_encode($payload, JSON_UNESCAPED_UNICODE));
                        }

                        continue;
                    }

                    if ($existing) {
                        $duplicateTarget = $this->findDuplicateTargetSpawn(
                            monsterId: $monster->id,
                            mapId: $map->id,
                            layerId: $layer->id,
                            spawnTime: $payload['spawn_time'],
                            excludeId: $existing->id
                        );

                        if ($duplicateTarget) {
                            $duplicateTarget->note = $this->appendNote(
                                $duplicateTarget->note,
                                $this->buildFinalNote($note, $version)
                            );

                            if ($refresh) {
                                $duplicateTarget->spawn_count = $spawnCount ?: $duplicateTarget->spawn_count;
                                $duplicateTarget->symbol_count = $symbolCount ?: $duplicateTarget->symbol_count;
                            }

                            $duplicateTarget->save();

                            $this->warn(sprintf(
                                '[MERGE] duplicate target exists. from_spawn_id=%d -> to_spawn_id=%d',
                                $existing->id,
                                $duplicateTarget->id
                            ));

                            $totalUpdated++;
                        } else {
                            $originalLayerId = $existing->map_layer_id;
                            $originalSpawnTime = $existing->spawn_time;

                            if ((int) $originalLayerId !== (int) $layer->id) {
                                $existing->map_layer_id = $layer->id;

                                $this->info(sprintf(
                                    '[LAYER更新] spawn_id=%d / %s -> %s',
                                    $existing->id,
                                    $originalLayerId ?? 'null',
                                    $layer->id
                                ));
                            }

                            if ($refresh) {
                                $existing->spawn_time = $spawnTime ?: ($existing->spawn_time ?: 'normal');
                                $existing->spawn_count = $spawnCount ?: $existing->spawn_count;
                                $existing->symbol_count = $symbolCount ?: $existing->symbol_count;
                            }

                            $existing->note = $this->appendNote(
                                $existing->note,
                                $this->buildFinalNote($note, $version)
                            );

                            $existing->save();

                            $this->info(sprintf(
                                '[UPDATE] monster_map_spawns.id=%d / spawn_time=%s->%s',
                                $existing->id,
                                $originalSpawnTime,
                                $existing->spawn_time
                            ));
                            $totalUpdated++;
                        }
                    } else {
                        $duplicateTarget = $this->findDuplicateTargetSpawn(
                            monsterId: $monster->id,
                            mapId: $map->id,
                            layerId: $layer->id,
                            spawnTime: $payload['spawn_time']
                        );

                        if ($duplicateTarget) {
                            $duplicateTarget->note = $this->appendNote(
                                $duplicateTarget->note,
                                $payload['note']
                            );

                            if ($refresh) {
                                $duplicateTarget->spawn_count = $spawnCount ?: $duplicateTarget->spawn_count;
                                $duplicateTarget->symbol_count = $symbolCount ?: $duplicateTarget->symbol_count;
                            }

                            $duplicateTarget->save();

                            $this->warn("[MERGE] create skipped, duplicate unique key already exists. target_id={$duplicateTarget->id}");
                            $totalUpdated++;
                        } else {
                            $created = MonsterMapSpawn::query()->create($payload);
                            $this->info("[CREATE] monster_map_spawns.id={$created->id}");
                            $totalCreated++;
                        }
                    }
                }
            } catch (Throwable $e) {
                $this->error("[ERROR] {$monsterName}: {$e->getMessage()}");
                $totalSkipped++;
            }
        }

        $csvPath = $this->writeUnresolvedLayerCsv($dryRun);

        $this->newLine();
        $this->info("完了 created={$totalCreated} updated={$totalUpdated} skipped={$totalSkipped} unresolved_layer={$totalUnresolvedLayer}");

        if ($csvPath) {
            $this->warn("未解決レイヤーCSV: {$csvPath}");
        }

        return self::SUCCESS;
    }

    protected function buildZukanPageUrl(int $pageNo): string
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

    protected function extractMonsterLinksFromZukanPage(string $html): Collection
    {
        $crawler = new Crawler($html, $this->baseUrl);

        $links = collect();

        $crawler->filter('a[href*="/wiki/"]')->each(function (Crawler $node) use (&$links) {
            $name = trim(html_entity_decode($node->text('', false)));

            if ($name === '') {
                return;
            }

            $href = $node->attr('href');
            if (! $href) {
                return;
            }

            $url = $this->absoluteUrl($href);

            if (preg_match('/^\d+ページ目$/u', $name)) {
                return;
            }

            if ($this->looksLikeNonMonsterLink($name, $url)) {
                return;
            }

            $links->push([
                'name' => $name,
                'url'  => $url,
            ]);
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

    /**
     * @return array{0: ?MapLayer, 1: string}
     */
    protected function resolveLayerForSpawn(Collection $layers, string $text): array
    {
        if ($layers->isEmpty()) {
            return [null, 'not_found'];
        }

        if ($layers->count() === 1) {
            /** @var MapLayer $single */
            $single = $layers->first();
            return [$single, 'single_layer'];
        }

        $byLayerName = $this->resolveLayerByLayerName($layers, $text);
        if ($byLayerName) {
            return [$byLayerName, 'matched'];
        }

        $byKeyword = $this->resolveLayerByKeywordFallback($layers, $text);
        if ($byKeyword) {
            return [$byKeyword, 'keyword'];
        }

        $floorNo = $this->extractFloorNo($text);
        if ($floorNo !== null) {
            $byFloorNo = $layers->firstWhere('floor_no', $floorNo);
            if ($byFloorNo) {
                return [$byFloorNo, 'floor_no'];
            }
        }

        $groundLayer = $this->resolveGroundLayer($layers);
        if ($groundLayer) {
            return [$groundLayer, 'ground_fallback'];
        }

        return [null, 'not_found'];
    }

    protected function resolveGroundLayer(Collection $layers): ?MapLayer
    {
        foreach ($layers as $layer) {
            $layerName = $this->normalizeLayerName((string) $layer->layer_name);

            if ($layerName === '') {
                continue;
            }

            if (
                Str::contains($layerName, '地上')
                || Str::contains($layerName, '外部')
                || Str::contains($layerName, 'フィールド')
                || $layerName === '1階'
                || $layerName === '1f'
                || $layerName === '1層'
            ) {
                return $layer;
            }
        }

        $floorOne = $layers->firstWhere('floor_no', 1);
        if ($floorOne) {
            return $floorOne;
        }

        return null;
    }

    protected function resolveLayerByLayerName(Collection $layers, string $text): ?MapLayer
    {
        $normalizedText = $this->normalizeLayerName($text);

        $bestLayer = null;
        $bestScore = 0;

        foreach ($layers as $layer) {
            $layerName = trim((string) $layer->layer_name);
            if ($layerName === '') {
                continue;
            }

            $normalizedLayerName = $this->normalizeLayerName($layerName);

            if ($normalizedLayerName === '') {
                continue;
            }

            if ($normalizedText === $normalizedLayerName) {
                return $layer;
            }

            if (
                Str::contains($normalizedText, $normalizedLayerName)
                || Str::contains($normalizedLayerName, $normalizedText)
            ) {
                return $layer;
            }

            $floorNo = $this->extractFloorNo($text);
            $layerFloorNo = $this->extractFloorNo($layerName);

            if ($floorNo !== null && $layerFloorNo !== null && $floorNo === $layerFloorNo) {
                return $layer;
            }

            $score = $this->scoreLayerNameAgainstText($layerName, $text);

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestLayer = $layer;
            }
        }

        if ($bestLayer && $bestScore >= 2) {
            return $bestLayer;
        }

        return null;
    }

    protected function resolveLayerByKeywordFallback(Collection $layers, string $text): ?MapLayer
    {
        $candidates = $this->buildLayerKeywordCandidates($text);

        if (empty($candidates)) {
            return null;
        }

        foreach ($candidates as $candidate) {
            $normalizedCandidate = $this->normalizeLayerName($candidate);

            foreach ($layers as $layer) {
                $layerName = trim((string) $layer->layer_name);
                if ($layerName === '') {
                    continue;
                }

                $normalizedLayerName = $this->normalizeLayerName($layerName);

                if ($normalizedCandidate !== '' && $normalizedCandidate === $normalizedLayerName) {
                    return $layer;
                }

                if (
                    $normalizedCandidate !== ''
                    && (
                        Str::contains($normalizedLayerName, $normalizedCandidate)
                        || Str::contains($normalizedCandidate, $normalizedLayerName)
                    )
                ) {
                    return $layer;
                }
            }
        }

        return null;
    }

    protected function scoreLayerNameAgainstText(string $layerName, string $text): int
    {
        $score = 0;

        $normalizedLayer = $this->normalizeLayerName($layerName);
        $normalizedText = $this->normalizeLayerName($text);

        if ($normalizedLayer === '' || $normalizedText === '') {
            return 0;
        }

        $layerTokens = $this->extractLayerTokens($layerName);
        $textTokens = $this->extractLayerTokens($text);

        foreach ($layerTokens as $token) {
            if ($token === '') {
                continue;
            }

            if (in_array($token, $textTokens, true)) {
                $score += 3;
                continue;
            }

            if (Str::contains($normalizedText, $token)) {
                $score += 2;
                continue;
            }

            foreach ($textTokens as $textToken) {
                if (
                    $textToken !== ''
                    && (
                        Str::contains($textToken, $token)
                        || Str::contains($token, $textToken)
                    )
                ) {
                    $score += 1;
                    break;
                }
            }
        }

        if (Str::contains($normalizedText, $normalizedLayer)) {
            $score += 2;
        }

        if (Str::contains($normalizedLayer, $normalizedText)) {
            $score += 1;
        }

        return $score;
    }

    protected function extractLayerTokens(string $text): array
    {
        $text = $this->normalizeText($text);
        $normalized = $this->normalizeLayerName($text);

        $tokens = [];

        if ($normalized !== '') {
            $tokens[] = $normalized;
        }

        $floorNo = $this->extractFloorNo($text);
        if ($floorNo !== null) {
            if ($floorNo > 0) {
                $tokens[] = "{$floorNo}階";
                $tokens[] = "{$floorNo}f";
                $tokens[] = "{$floorNo}層";
            } else {
                $abs = abs($floorNo);
                $tokens[] = "地下{$abs}階";
                $tokens[] = "b{$abs}f";
            }
        }

        $parts = preg_split('/[・\/\-\s　]+/u', $text) ?: [];
        foreach ($parts as $part) {
            $part = $this->normalizeLayerName($part);
            if (mb_strlen($part) >= 2) {
                $tokens[] = $part;
            }
        }

        $noParts = preg_split('/の/u', $text) ?: [];
        foreach ($noParts as $part) {
            $part = $this->normalizeLayerName($part);
            if (mb_strlen($part) >= 2) {
                $tokens[] = $part;
            }
        }

        foreach ($this->extractTerrainSuffixTokens($text) as $token) {
            $tokens[] = $token;
        }

        $keywordGroups = [
            ['地上', '外部', 'フィールド'],
            ['内部'],
            ['上層'],
            ['中層'],
            ['下層'],
            ['洞窟', '洞くつ'],
            ['地下水路'],
            ['遺跡'],
            ['塔'],
            ['神殿'],
            ['井戸'],
            ['入口'],
            ['通路'],
            ['広間'],
            ['東'],
            ['西'],
            ['南'],
            ['北'],
        ];

        foreach ($keywordGroups as $group) {
            foreach ($group as $word) {
                $normalizedWord = $this->normalizeLayerName($word);

                if (
                    Str::contains($normalized, $normalizedWord)
                    || Str::contains($text, $word)
                ) {
                    $tokens[] = $this->normalizeLayerName($group[0]);
                    break;
                }
            }
        }

        return array_values(array_unique(array_filter($tokens, function ($token) {
            return mb_strlen($token) >= 2;
        })));
    }

    protected function extractTerrainSuffixTokens(string $text): array
    {
        $text = $this->normalizeText($text);
        $normalized = $this->normalizeLayerName($text);

        $tokens = [];

        $terrainWords = [
            '原野',
            '荒野',
            '平原',
            '高原',
            '草原',
            '丘陵',
            '湿原',
            '雪原',
            '林',
            '森',
            '山',
            '山地',
            '山道',
            '峠',
            '谷',
            '渓谷',
            '洞窟',
            'どうくつ',
            '遺跡',
            '神殿',
            '塔',
            '水路',
            '地下水路',
            '通路',
            '広間',
            '墓地',
            '街道',
            '海岸',
            '砂浜',
            '砂漠',
            '湖',
            '沼',
            '沼地',
            '島',
            '半島',
            '平野',
            '台地',
            '岩場',
            '坑道',
            '鉱山',
            '城',
            '宮殿',
        ];

        foreach ($terrainWords as $word) {
            $normalizedWord = $this->normalizeLayerName($word);

            if (
                $normalizedWord !== ''
                && (
                    Str::endsWith($normalized, $normalizedWord)
                    || Str::contains($normalized, $normalizedWord)
                )
            ) {
                $tokens[] = $normalizedWord;
            }
        }

        return array_values(array_unique($tokens));
    }

    protected function buildLayerKeywordCandidates(string $text): array
    {
        $text = $this->normalizeText($text);
        $candidates = [];

        $floorNo = $this->extractFloorNo($text);

        if ($floorNo !== null) {
            if ($floorNo > 0) {
                $candidates[] = "{$floorNo}階";
                $candidates[] = "{$floorNo}F";
                $candidates[] = "第{$floorNo}層";
                $candidates[] = "{$floorNo}層";
            } elseif ($floorNo < 0) {
                $abs = abs($floorNo);
                $candidates[] = "地下{$abs}階";
                $candidates[] = "B{$abs}F";
            }
        }

        $keywordMap = [
            '第一層' => ['第一層', '1層', '第1層'],
            '第二層' => ['第二層', '2層', '第2層'],
            '第三層' => ['第三層', '3層', '第3層'],
            '第四層' => ['第四層', '4層', '第4層'],
            '第五層' => ['第五層', '5層', '第5層'],
            '地下一階' => ['地下一階', '地下1階', 'B1F'],
            '地下二階' => ['地下二階', '地下2階', 'B2F'],
            '地下三階' => ['地下三階', '地下3階', 'B3F'],
            '上層' => ['上層'],
            '下層' => ['下層'],
            '中層' => ['中層'],
            '内部' => ['内部'],
            '外部' => ['外部'],
            '洞窟' => ['洞窟'],
            '地下水路' => ['地下水路'],
            '遺跡' => ['遺跡'],
            '塔' => ['塔'],
            '神殿' => ['神殿'],
            '井戸' => ['井戸'],
        ];

        foreach ($keywordMap as $trigger => $variants) {
            if (Str::contains($text, $trigger)) {
                foreach ($variants as $variant) {
                    $candidates[] = $variant;
                }
            }
        }

        if (preg_match('/第([一二三四五六七八九十]+)層/u', $text, $m)) {
            $n = $this->kanjiNumberToInt($m[1]);
            if ($n !== null) {
                $candidates[] = "第{$n}層";
                $candidates[] = "{$n}層";
                $candidates[] = "{$n}階";
            }
        }

        if (preg_match('/([一二三四五六七八九十]+)階/u', $text, $m)) {
            $n = $this->kanjiNumberToInt($m[1]);
            if ($n !== null) {
                $candidates[] = "{$n}階";
                $candidates[] = "{$n}F";
                $candidates[] = "第{$n}層";
                $candidates[] = "{$n}層";
            }
        }

        if (preg_match('/地下([一二三四五六七八九十]+)階/u', $text, $m)) {
            $n = $this->kanjiNumberToInt($m[1]);
            if ($n !== null) {
                $candidates[] = "地下{$n}階";
                $candidates[] = "B{$n}F";
            }
        }

        return array_values(array_unique(array_filter($candidates)));
    }

    protected function normalizeLayerName(?string $text): string
    {
        $text = $this->normalizeText($text);
        $text = mb_convert_kana($text, 'asKV', 'UTF-8');
        $text = mb_strtolower($text, 'UTF-8');

        $replacements = [
            '　第' => '第',
            '階層' => '層',
            'フロア' => 'f',
            'ｆ' => 'f',
            'ｂ' => 'b',
            '洞くつ' => '洞窟',
            'どうくつ' => '洞窟',
            '屋外' => '外部',
            '屋内' => '内部',
            '地上一階' => '1階',
            '地上1階' => '1階',
            '一階' => '1階',
            '二階' => '2階',
            '三階' => '3階',
            '四階' => '4階',
            '五階' => '5階',
            '六階' => '6階',
            '七階' => '7階',
            '八階' => '8階',
            '九階' => '9階',
            '十階' => '10階',
            '第一層' => '1層',
            '第二層' => '2層',
            '第三層' => '3層',
            '第四層' => '4層',
            '第五層' => '5層',
            '第六層' => '6層',
            '第七層' => '7層',
            '第八層' => '8層',
            '第九層' => '9層',
            '第十層' => '10層',
            '地下一階' => '地下1階',
            '地下二階' => '地下2階',
            '地下三階' => '地下3階',
        ];

        $text = strtr($text, $replacements);
        $text = preg_replace('/[()\[\]（）【】「」『』・,，.．:：;；\/]/u', '', $text);
        $text = preg_replace('/\s+/u', '', $text);

        return trim($text);
    }

    protected function extractFloorNo(string $text): ?int
    {
        $text = $this->normalizeText($text);
        $normalized = $this->normalizeLayerName($text);

        if (preg_match('/地下([0-9]+)階/u', $normalized, $m)) {
            return -1 * (int) $m[1];
        }

        if (preg_match('/b([0-9]+)f/iu', $normalized, $m)) {
            return -1 * (int) $m[1];
        }

        if (preg_match('/([0-9]+)階/u', $normalized, $m)) {
            return (int) $m[1];
        }

        if (preg_match('/([0-9]+)層/u', $normalized, $m)) {
            return (int) $m[1];
        }

        if (preg_match('/([0-9]+)f/iu', $normalized, $m)) {
            return (int) $m[1];
        }

        if (preg_match('/第([一二三四五六七八九十]+)層/u', $text, $m)) {
            return $this->kanjiNumberToInt($m[1]);
        }

        if (preg_match('/([一二三四五六七八九十]+)階/u', $text, $m)) {
            return $this->kanjiNumberToInt($m[1]);
        }

        if (preg_match('/地下([一二三四五六七八九十]+)階/u', $text, $m)) {
            $n = $this->kanjiNumberToInt($m[1]);
            return $n !== null ? -1 * $n : null;
        }

        return null;
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

    protected function buildFinalNote(?string $desc, ?string $version): ?string
    {
        $desc = trim((string) $desc);
        $version = trim((string) $version);

        if ($desc === '' && $version === '') {
            return null;
        }

        if ($desc === '') {
            return "ver: {$version}";
        }

        if ($version === '') {
            return $desc;
        }

        return $desc . "\n" . "ver: {$version}";
    }

    protected function appendNote($existingNote, $newNote): ?string
    {
        if (is_array($existingNote)) {
            $existingNote = implode("\n", array_map('strval', $existingNote));
        }

        if (is_array($newNote)) {
            $newNote = implode("\n", array_map('strval', $newNote));
        }

        $existingNote = trim((string) $existingNote);
        $newNote = trim((string) $newNote);

        if ($existingNote === '' && $newNote === '') {
            return null;
        }

        if ($existingNote === '') {
            return $newNote;
        }

        if ($newNote === '') {
            return $existingNote;
        }

        if ($existingNote === $newNote) {
            return $existingNote;
        }

        if (Str::contains($existingNote, $newNote)) {
            return $existingNote;
        }

        return $existingNote . "\n\n" . $newNote;
    }

    protected function findExistingSpawn(int $monsterId, int $mapId, int $layerId, string $spawnTime): ?MonsterMapSpawn
    {
        $exact = MonsterMapSpawn::query()
            ->where('monster_id', $monsterId)
            ->where('map_id', $mapId)
            ->where('map_layer_id', $layerId)
            ->where('spawn_time', $spawnTime)
            ->first();

        if ($exact) {
            return $exact;
        }

        $layerNull = MonsterMapSpawn::query()
            ->where('monster_id', $monsterId)
            ->where('map_id', $mapId)
            ->where('spawn_time', $spawnTime)
            ->whereNull('map_layer_id')
            ->first();

        if ($layerNull) {
            return $layerNull;
        }

        $sameLayer = MonsterMapSpawn::query()
            ->where('monster_id', $monsterId)
            ->where('map_id', $mapId)
            ->where('map_layer_id', $layerId)
            ->first();

        if ($sameLayer) {
            return $sameLayer;
        }

        return null;
    }

    protected function findDuplicateTargetSpawn(
        int $monsterId,
        int $mapId,
        int $layerId,
        string $spawnTime,
        ?int $excludeId = null
    ): ?MonsterMapSpawn {
        $query = MonsterMapSpawn::query()
            ->where('monster_id', $monsterId)
            ->where('map_id', $mapId)
            ->where('map_layer_id', $layerId)
            ->where('spawn_time', $spawnTime);

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->first();
    }

    protected function pushUnresolvedLayerRow(array $row): void
    {
        $this->unresolvedLayerRows[] = $row;
    }

    protected function writeUnresolvedLayerCsv(bool $dryRun): ?string
    {
        if (empty($this->unresolvedLayerRows)) {
            return null;
        }

        $dir = 'dqx/import_logs';
        $filename = 'unresolved_monster_map_spawns_' . now()->format('Ymd_His') . ($dryRun ? '_dry_run' : '') . '.csv';
        $path = $dir . '/' . $filename;

        Storage::makeDirectory($dir);

        $stream = fopen('php://temp', 'r+');

        fputcsv($stream, [
            'monster_id',
            'monster_name',
            'monster_url',
            'map_id',
            'map_name',
            'map_layer_candidates',
            'section',
            'note',
            'version',
            'spawn_time',
            'spawn_count',
            'symbol_count',
            'reason',
        ]);

        foreach ($this->unresolvedLayerRows as $row) {
            fputcsv($stream, [
                $row['monster_id'] ?? null,
                $row['monster_name'] ?? null,
                $row['monster_url'] ?? null,
                $row['map_id'] ?? null,
                $row['map_name'] ?? null,
                $row['map_layer_candidates'] ?? null,
                $row['section'] ?? null,
                $row['note'] ?? null,
                $row['version'] ?? null,
                $row['spawn_time'] ?? null,
                $row['spawn_count'] ?? null,
                $row['symbol_count'] ?? null,
                $row['reason'] ?? null,
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        Storage::put($path, $csv);

        return storage_path('app/' . $path);
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

    protected function looksLikeNonMonsterLink(string $name, string $url): bool
    {
        if (preg_match('/^(トップページ|コメント|編集|添付|差分|バックアップ|新規|一覧)$/u', $name)) {
            return true;
        }

        if (preg_match('/\/wiki\/(\d+ページ目|[あ-ん]行|スライム系|けもの系|ドラゴン系|虫系|鳥系|植物系|物質系|マシン系|ゾンビ系|あくま系|エレメント系|怪人系|水系|その他の地域)$/u', urldecode($url))) {
            return true;
        }

        return false;
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

    protected function kanjiNumberToInt(string $text): ?int
    {
        $map = [
            '一' => 1,
            '二' => 2,
            '三' => 3,
            '四' => 4,
            '五' => 5,
            '六' => 6,
            '七' => 7,
            '八' => 8,
            '九' => 9,
            '十' => 10,
        ];

        return $map[$text] ?? null;
    }
}