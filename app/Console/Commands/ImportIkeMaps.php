<?php

namespace App\Console\Commands;

use App\Models\Map;
use App\Models\MapLayer;
use App\Models\Monster;
use App\Models\MonsterMapSpawn;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\DomCrawler\Crawler;
use Throwable;

class ImportIkeMaps extends Command
{
    protected $signature = 'dq10:import-ike-maps
        {--fresh : map_layers と monster_map_spawns を truncate してから取り込む}
        {--only= : マップ名にこの文字列を含むものだけ対象}
        {--limit= : 初期一覧の先頭n件だけ処理}
        {--redownload : 既存画像があっても再ダウンロードする}
        {--only-empty-maps : DBに未登録の maps だけ初期対象にする}
        {--skip-images : 画像を保存しない}
        {--dry-run : DB保存も画像保存もしない}
        {--max-depth=5 : MAP内リンクをたどる最大深さ}';

    protected $description = 'IKEドラクエ10攻略のマップ一覧とMAP内リンクを巡回して、既存 maps に対して map_layers / monster_map_spawns を取り込む';

    private string $indexUrl = 'https://dq10.i-k-e.net/map/';
    private string $baseUrl = 'https://dq10.i-k-e.net';

    private array $errorRows = [];
    private array $indexMapMetaByUrl = [];
    private array $indexMapMetaByName = [];

    private function httpClient()
    {
        return Http::withHeaders([
            'Referer' => $this->baseUrl . '/',
            'User-Agent' => 'Mozilla/5.0 (compatible; ImportIkeMaps/1.0)',
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

    private function pushErrorRow(array $entry, string $message): void
    {
        $this->errorRows[] = [
            'name' => (string) ($entry['name'] ?? ''),
            'url' => (string) ($entry['url'] ?? ''),
            'continent' => (string) ($entry['continent'] ?? ''),
            'depth' => (string) ($entry['depth'] ?? 0),
            'root_name' => (string) ($entry['root_name'] ?? ''),
            'root_index' => (string) ($entry['root_index'] ?? ''),
            'root_total' => (string) ($entry['root_total'] ?? ''),
            'child_index' => (string) ($entry['child_index'] ?? ''),
            'child_total' => (string) ($entry['child_total'] ?? ''),
            'discovered_from' => (string) ($entry['discovered_from'] ?? ''),
            'error_message' => $message,
            'recorded_at' => now()->toDateTimeString(),
        ];
    }

    private function writeErrorCsv(): ?string
    {
        if (empty($this->errorRows)) {
            return null;
        }

        $dir = storage_path('app/ike_map_import_errors');

        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $filePath = $dir . '/ike_map_import_errors_' . now()->format('Ymd_His') . '.csv';

        $fp = fopen($filePath, 'w');
        if ($fp === false) {
            $this->warn('error CSV の作成に失敗した');
            return null;
        }

        fwrite($fp, "\xEF\xBB\xBF");

        $headers = [
            'name',
            'url',
            'continent',
            'depth',
            'root_name',
            'root_index',
            'root_total',
            'child_index',
            'child_total',
            'discovered_from',
            'error_message',
            'recorded_at',
        ];

        fputcsv($fp, $headers);

        foreach ($this->errorRows as $row) {
            fputcsv($fp, [
                $row['name'],
                $row['url'],
                $row['continent'],
                $row['depth'],
                $row['root_name'],
                $row['root_index'],
                $row['root_total'],
                $row['child_index'],
                $row['child_total'],
                $row['discovered_from'],
                $row['error_message'],
                $row['recorded_at'],
            ]);
        }

        fclose($fp);

        return $filePath;
    }

    public function handle(): int
    {
        try {
            if ($this->option('fresh')) {
                $this->truncateTables();
            }

            $html = $this->fetchHtml($this->indexUrl);
            if (!$html) {
                $this->error('一覧ページの取得に失敗した');
                return self::FAILURE;
            }

            $entries = $this->parseIndex($html);
            $this->buildIndexMapMeta($entries);

            $only = trim((string) $this->option('only'));
            if ($only !== '') {
                $entries = array_values(array_filter($entries, function (array $row) use ($only) {
                    return mb_stripos($row['name'], $only) !== false;
                }));
            }

            if ($this->option('only-empty-maps')) {
                $entries = array_values(array_filter($entries, function (array $row) {
                    return !Map::query()->where('name', $row['name'])->exists();
                }));
            }

            $limit = (int) $this->option('limit');
            if ($limit > 0) {
                $entries = array_slice($entries, 0, $limit);
            }

            $initialTotal = count($entries);
            $this->info('初期対象件数: ' . $initialTotal);

            $queue = [];
            foreach ($entries as $index => $entry) {
                $queue[] = [
                    'continent' => $entry['continent'],
                    'name' => $entry['name'],
                    'url' => $entry['url'],
                    'depth' => 0,
                    'discovered_from' => null,
                    'root_name' => $entry['name'],
                    'root_index' => $index + 1,
                    'root_total' => $initialTotal,
                    'child_index' => null,
                    'child_total' => null,
                ];
            }

            $seen = [];
            $processed = 0;
            $maxDepth = max(0, (int) $this->option('max-depth'));

            while (!empty($queue)) {
                $entry = array_shift($queue);
                $urlKey = $this->normalizeUrlKey($entry['url']);

                if (isset($seen[$urlKey])) {
                    continue;
                }

                $seen[$urlKey] = true;

                $this->newLine();
                $this->printProgressHeader($entry);

                try {
                    $result = $this->importMapDetail($entry);
                    $processed++;

                    if ($entry['depth'] < $maxDepth) {
                        $children = [];
                        $skipped = 0;

                        foreach ($result['map_links'] as $child) {
                            $childUrlKey = $this->normalizeUrlKey($child['url']);
                            if (isset($seen[$childUrlKey])) {
                                $skipped++;
                                continue;
                            }

                            $children[] = $child;
                        }

                        $this->line(sprintf(
                            '  %s の中で見つかった MAP URL: 新規 %d件 / 既出 %d件',
                            $result['map_name'],
                            count($children),
                            $skipped
                        ));

                        foreach ($children as $child) {
                            $childContinent = $this->resolveContinentForMap(
                                name: $child['name'],
                                url: $child['url'],
                                fallback: $entry['continent']
                            );

                            $childContinent = $this->normalizeContinentName($childContinent);
                            $predictedType = $this->guessMapTypeFromName($child['name']);

                            $this->line(sprintf(
                                '    - name=%s | continent=%s | map_type=%s | url=%s',
                                $child['name'],
                                $childContinent,
                                $predictedType,
                                $child['url']
                            ));
                        }

                        foreach ($children as $i => $child) {
                            $childContinent = $this->resolveContinentForMap(
                                name: $child['name'],
                                url: $child['url'],
                                fallback: $entry['continent']
                            );

                            $childContinent = $this->normalizeContinentName($childContinent);

                            $queue[] = [
                                'continent' => $childContinent,
                                'name' => $child['name'],
                                'url' => $child['url'],
                                'depth' => $entry['depth'] + 1,
                                'discovered_from' => $result['map_name'],
                                'root_name' => $entry['root_name'],
                                'root_index' => $entry['root_index'],
                                'root_total' => $entry['root_total'],
                                'child_index' => $i + 1,
                                'child_total' => count($children),
                            ];
                        }
                    }
                } catch (Throwable $e) {
                    $this->error("error: {$entry['name']} / {$entry['url']}");
                    $this->error($e->getMessage());

                    $this->pushErrorRow($entry, $e->getMessage());
                }
            }

            $this->newLine();
            $errorCsvPath = $this->writeErrorCsv();

            $this->newLine();
            $this->info("完了: {$processed}ページ処理");

            if (!empty($this->errorRows)) {
                $this->warn('失敗件数: ' . count($this->errorRows));
                if ($errorCsvPath) {
                    $this->warn('error CSV: ' . $errorCsvPath);
                }
            }

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }

    private function printProgressHeader(array $entry): void
    {
        $rootIndex = $entry['root_index'] ?? 0;
        $rootTotal = $entry['root_total'] ?? 0;
        $rootName = $entry['root_name'] ?? $entry['name'];

        if (($entry['depth'] ?? 0) === 0) {
            $this->info(sprintf(
                '[初期一覧 %d/%d] 巡回中: %s',
                $rootIndex,
                $rootTotal,
                $entry['name']
            ));
            return;
        }

        $childIndex = $entry['child_index'] ?? 0;
        $childTotal = $entry['child_total'] ?? 0;
        $parentName = $entry['discovered_from'] ?? $rootName;

        $this->comment(sprintf(
            '[初期一覧 %d/%d: %s]',
            $rootIndex,
            $rootTotal,
            $rootName
        ));
        $this->info(sprintf(
            '  %s が終わったので、その中のMAP URLを巡回中: %d/%d',
            $parentName,
            $childIndex,
            $childTotal
        ));
        $this->line(sprintf('  子MAP: %s', $entry['name']));
    }

    private function truncateTables(): void
    {
        $this->warn('map_layers / monster_map_spawns を truncate する');

        if ($this->option('dry-run')) {
            $this->line('[dry-run] truncate skipped');
            return;
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        if (Schema::hasTable('monster_map_spawns')) {
            DB::table('monster_map_spawns')->truncate();
        }

        if (Schema::hasTable('map_layers')) {
            DB::table('map_layers')->truncate();
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }

    private function parseIndex(string $html): array
    {
        $crawler = new Crawler($html, $this->indexUrl);

        $rows = [];
        $currentContinent = null;
        $bodyChildren = $crawler->filter('body')->children();

        foreach ($bodyChildren as $node) {
            $nodeCrawler = new Crawler($node, $this->indexUrl);
            $tag = strtolower($node->nodeName);
            $class = (string) ($node->attributes?->getNamedItem('class')?->nodeValue ?? '');

            if ($tag === 'div' && Str::contains($class, 'SectSlide-Header-InfoArea')) {
                if ($nodeCrawler->filter('h3.Title')->count()) {
                    $title = $this->normalizeText($nodeCrawler->filter('h3.Title')->first()->text(''));
                    if ($this->looksLikeContinent($title)) {
                        $currentContinent = $title;
                        continue;
                    }
                }
            }

            if ($tag === 'h3' || $nodeCrawler->filter('h3.Title')->count()) {
                $title = '';

                if ($tag === 'h3') {
                    $title = $this->normalizeText($node->textContent ?? '');
                } elseif ($nodeCrawler->filter('h3.Title')->count()) {
                    $title = $this->normalizeText($nodeCrawler->filter('h3.Title')->first()->text(''));
                }

                if ($this->looksLikeContinent($title)) {
                    $currentContinent = $title;
                    continue;
                }
            }

            if (in_array($tag, ['h2', 'h3', 'h4'], true)) {
                $title = $this->normalizeText($node->textContent ?? '');
                if ($this->looksLikeContinent($title)) {
                    $currentContinent = $title;
                    continue;
                }
            }

            if (!in_array($tag, ['ul', 'ol', 'div', 'section', 'article', 'p'], true)) {
                continue;
            }

            $nodeCrawler->filter('a[href]')->each(function (Crawler $a) use (&$rows, $currentContinent) {
                $href = trim((string) $a->attr('href'));
                if ($href === '') {
                    return;
                }

                if (Str::startsWith($href, ['#', 'javascript:'])) {
                    return;
                }

                $url = $this->absoluteUrl($href);

                if (!Str::startsWith($url, $this->baseUrl . '/map/')) {
                    return;
                }

                if ($this->normalizeUrlKey($url) === rtrim($this->indexUrl, '/')) {
                    return;
                }

                $name = $this->normalizeText($a->text(''));
                if ($name === '') {
                    $name = $this->inferMapNameFromUrl($url);
                }

                $name = $this->cleanMapName($name);

                if ($name === '' || $name === '全体MAP') {
                    return;
                }

                if ($this->looksLikeContinent($name)) {
                    return;
                }

                $rows[] = [
                    'continent' => $currentContinent ?: '不明',
                    'name' => $name,
                    'url' => $url,
                ];
            });
        }

        if (count($rows) === 0 || count(array_filter($rows, fn ($r) => ($r['continent'] ?? '不明') !== '不明')) === 0) {
            $rows = $this->parseIndexFallbackByHeadings($crawler);
        }

        $unique = [];
        foreach ($rows as $row) {
            $unique[$this->normalizeUrlKey($row['url'])] = $row;
        }

        return array_values($unique);
    }

    private function parseIndexFallbackByHeadings(Crawler $crawler): array
    {
        $rows = [];
        $currentContinent = null;

        foreach ($crawler->filter('h2, h3, h4, h5, ul, ol, p, div, section, article') as $node) {
            $nodeCrawler = new Crawler($node, $this->indexUrl);
            $tag = strtolower($node->nodeName);

            if (in_array($tag, ['h2', 'h3', 'h4', 'h5'], true)) {
                $title = $this->normalizeText($node->textContent ?? '');
                if ($this->looksLikeContinent($title)) {
                    $currentContinent = $title;
                    continue;
                }
            }

            $nodeCrawler->filter('a[href]')->each(function (Crawler $a) use (&$rows, $currentContinent) {
                $href = trim((string) $a->attr('href'));
                if ($href === '') {
                    return;
                }

                $url = $this->absoluteUrl($href);

                if (!Str::startsWith($url, $this->baseUrl . '/map/')) {
                    return;
                }

                if ($this->normalizeUrlKey($url) === rtrim($this->indexUrl, '/')) {
                    return;
                }

                $name = $this->normalizeText($a->text(''));
                if ($name === '') {
                    $name = $this->inferMapNameFromUrl($url);
                }

                $name = $this->cleanMapName($name);

                if ($name === '' || $name === '全体MAP' || $this->looksLikeContinent($name)) {
                    return;
                }

                $rows[] = [
                    'continent' => $currentContinent ?: '不明',
                    'name' => $name,
                    'url' => $url,
                ];
            });
        }

        return $rows;
    }

    private function buildIndexMapMeta(array $entries): void
    {
        $this->indexMapMetaByUrl = [];
        $this->indexMapMetaByName = [];

        foreach ($entries as $row) {
            $urlKey = $this->normalizeUrlKey($row['url']);
            $nameKey = $this->normalizeNameKey($row['name']);

            $meta = [
                'continent' => $row['continent'] ?? '不明',
                'name' => $row['name'] ?? '',
                'url' => $row['url'] ?? '',
            ];

            $this->indexMapMetaByUrl[$urlKey] = $meta;

            if ($nameKey !== '') {
                $this->indexMapMetaByName[$nameKey] = $meta;
            }
        }
    }

    private function normalizeNameKey(string $name): string
    {
        return mb_strtolower($this->cleanMapName($name));
    }

    private function resolveContinentForMap(string $name, string $url, ?string $fallback = null): string
    {
        $urlKey = $this->normalizeUrlKey($url);
        if (isset($this->indexMapMetaByUrl[$urlKey])) {
            return $this->indexMapMetaByUrl[$urlKey]['continent'] ?: ($fallback ?: '不明');
        }

        $nameKey = $this->normalizeNameKey($name);
        if ($nameKey !== '' && isset($this->indexMapMetaByName[$nameKey])) {
            return $this->indexMapMetaByName[$nameKey]['continent'] ?: ($fallback ?: '不明');
        }

        return $fallback ?: '不明';
    }

    private function importMapDetail(array $entry): array
    {
        $html = $this->fetchHtml($entry['url']);
        if (!$html) {
            throw new \RuntimeException('詳細ページ取得失敗（timeout or non-200）');
        }

        $crawler = new Crawler($html, $entry['url']);

        $mapName = $entry['name'];
        if ($crawler->filter('h1')->count()) {
            $mapName = $this->normalizeText($crawler->filter('h1')->first()->text(''));
        }
        if ($mapName === '') {
            $mapName = $entry['name'];
        }
        $mapName = $this->cleanMapName($mapName);

        $existingMap = Map::query()->where('name', $mapName)->first();

        if ($existingMap) {
            $this->debugLine(sprintf(
                '[MAP解決] FOUND map_id=%d / name=%s / input_name=%s',
                $existingMap->id,
                $existingMap->name,
                $mapName
            ));
        } else {
            $this->debugLine(sprintf(
                '[MAP解決] NOT_FOUND input_name=%s / url=%s',
                $mapName,
                $entry['url']
            ));
        }

        if (!$existingMap) {
            $message = "maps テーブルに未登録のため skip: {$mapName}";
            $this->warn('  ' . $message);
            $this->pushErrorRow($entry, $message);

            $pageData = $this->extractPageData($crawler);

            return [
                'map_name' => $mapName,
                'map_links' => $pageData['map_links'] ?? [],
            ];
        }

        $pageData = $this->extractPageData($crawler);

        $layers = $pageData['layers'];
        $monsterCount = $pageData['monster_count'];
        $monsterSpawns = $pageData['monster_spawns'] ?? [];
        $sectionDebug = $pageData['section_debug'];
        $mapLinks = $pageData['map_links'];

        $layerPayloads = [];
        foreach ($layers as $layer) {
            $layerName = $layer['layer_name'] ?? '地上';
            if ($layerName === null || trim((string) $layerName) === '') {
                $layerName = '地上';
            }

            $layerPayloads[] = [
                'layer_name' => $layerName,
                'floor_no' => $this->parseFloorNo($layerName),
                'image_path' => $this->option('skip-images') ? null : '[download later]',
                'source_url' => $entry['url'],
                'display_order' => $layer['display_order'],
                'image_url' => $layer['image_url'],
            ];
        }

        if ($this->option('dry-run')) {
            $this->printDryRun(
                entry: $entry,
                mapName: $mapName,
                mapId: $existingMap->id,
                layerPayloads: $layerPayloads,
                monsterCount: $monsterCount,
                sectionDebug: $sectionDebug,
                mapLinks: $mapLinks,
                monsterSpawns: $monsterSpawns
            );

            return [
                'map_name' => $mapName,
                'map_links' => $mapLinks,
            ];
        }

        $savedLayersByName = [];

        foreach ($layers as $layer) {
            $layerName = $layer['layer_name'] ?? '地上';
            if ($layerName === null || trim((string) $layerName) === '') {
                $layerName = '地上';
            }

            $layerName = $this->normalizeLayerKey($layerName);
            $floorNo = $this->parseFloorNo($layerName);
            $imagePath = null;

            if (!$this->option('skip-images') && !empty($layer['image_url'])) {
                $imagePath = $this->downloadImage(
                    $layer['image_url'],
                    $existingMap->id,
                    (string) ($existingMap->continent ?? '不明'),
                    $floorNo,
                    $layerName
                );
            }

            $exists = $this->findExistingLayerForImport(
                mapId: $existingMap->id,
                layerName: $layerName,
                floorNo: $floorNo
            );

            $payload = [
                'map_id' => $existingMap->id,
                'layer_name' => $layerName,
                'floor_no' => $floorNo,
                'image_path' => $imagePath ?: $exists?->image_path,
                'source_url' => $entry['url'],
                'display_order' => $layer['display_order'],
            ];

            if ($exists) {
                $dirty = false;

                foreach ($payload as $field => $value) {
                    if ($field === 'image_path' && ($value === null || $value === '')) {
                        continue;
                    }

                    if ($exists->{$field} != $value) {
                        $exists->{$field} = $value;
                        $dirty = true;
                    }
                }

                if ($dirty) {
                    $exists->save();
                }

                $savedLayer = $exists;
            } else {
                $savedLayer = MapLayer::query()->create($payload);
            }

            $this->debugLine(sprintf(
                '[MAP_LAYER保存] map_id=%d / map_name=%s / layer_id=%d / layer_name=%s / floor_no=%s / action=%s',
                $existingMap->id,
                $existingMap->name,
                $savedLayer->id,
                $savedLayer->layer_name ?? 'null',
                $savedLayer->floor_no ?? 'null',
                $exists ? 'update-or-keep' : 'create'
            ));

            $savedLayersByName[$this->normalizeLayerKey($layerName)] = $savedLayer;
        }

        $this->upsertMonsterMapSpawns(
            map: $existingMap,
            savedLayersByName: $savedLayersByName,
            monsterSpawns: $monsterSpawns
        );

        $this->line(sprintf(
            '  保存: map_id=%d / name=%s / layers=%d / monsters=%d / spawns=%d / child_links=%d',
            $existingMap->id,
            $mapName,
            count($layers),
            $monsterCount,
            count($monsterSpawns),
            count($mapLinks)
        ));

        return [
            'map_name' => $mapName,
            'map_links' => $mapLinks,
        ];
    }

    private function extractPageData(Crawler $crawler): array
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

        if ($articles->count() === 0) {
            $articles = new Crawler(iterator_to_array($articleBody), $crawler->getUri());
        }

        $layers = [];
        $monsterCount = 0;
        $monsterSpawns = [];
        $mapLinks = [];
        $sectionDebug = [];
        $displayOrder = 1;
        $currentLayerName = '地上';

        foreach ($articles as $node) {
            $section = new Crawler($node, $crawler->getUri());

            $heading = $this->extractSectionHeading($section);
            $sectionLayerByHeading = $this->detectLayerNameFromText($heading);

            $debugRow = [
                'heading' => $heading,
                'resolved_layer_name' => null,
                'map_images' => 0,
                'monster_links' => 0,
                'monster_spawns' => 0,
                'map_links' => 0,
            ];

            if ($heading !== '' && $this->isMapHeading($heading)) {
                $resolvedLayerName = $this->normalizeLayerName($heading) ?: '地上';
                $currentLayerName = $resolvedLayerName;

                $imageUrls = $this->extractMapImagesFromSection($section);
                $debugRow['resolved_layer_name'] = $resolvedLayerName;
                $debugRow['map_images'] = count($imageUrls);

                foreach ($imageUrls as $idx => $imageUrl) {
                    $layerName = $resolvedLayerName;

                    if (($layerName === null || $layerName === '地上') && count($imageUrls) > 1) {
                        $layerName = 'layer' . ($idx + 1);
                    }

                    $layers[] = [
                        'layer_name' => $this->normalizeLayerKey($layerName ?: '地上'),
                        'floor_no' => $this->parseFloorNo($layerName ?: '地上'),
                        'display_order' => $displayOrder++,
                        'image_url' => $imageUrl,
                    ];
                }
            }

            if ($sectionLooksLikeMonster = $this->sectionLooksLikeMonsterSection($section, $heading)) {
                $spawnLayerName = $this->resolveMonsterSectionLayerName(
                    $section,
                    $heading,
                    $sectionLayerByHeading ?: $currentLayerName
                );

                $monsterCards = $this->extractMonsterCardsFromSection($section, $spawnLayerName);

                if (!empty($monsterCards)) {
                    $currentLayerName = $spawnLayerName;
                }

                $monsterCount = max($monsterCount, count($monsterCards));
                $debugRow['resolved_layer_name'] = $spawnLayerName;
                $debugRow['monster_links'] = count($monsterCards);
                $debugRow['monster_spawns'] = count($monsterCards);
                $debugRow['monster_names'] = array_values(array_map(fn ($row) => $row['monster_name'], $monsterCards));

                foreach ($monsterCards as $card) {
                    $monsterSpawns[] = $card;
                }
            }

            if (!$sectionLooksLikeMonster && $sectionLayerByHeading) {
                $currentLayerName = $sectionLayerByHeading;
            }

            $sectionDebug[] = $debugRow;
        }

        if ($monsterCount === 0 && empty($monsterSpawns)) {
            $fallbackMonsterCards = $this->extractMonsterCardsFromSection($articleBody, $currentLayerName ?: '地上');

            if (!empty($fallbackMonsterCards)) {
                $monsterCount = count($fallbackMonsterCards);

                foreach ($fallbackMonsterCards as $card) {
                    $monsterSpawns[] = $card;
                }

                $sectionDebug[] = [
                    'heading' => '[fallback page-wide RpCardList]',
                    'resolved_layer_name' => $currentLayerName ?: '地上',
                    'map_images' => count($layers),
                    'monster_links' => $monsterCount,
                    'monster_spawns' => count($fallbackMonsterCards),
                    'map_links' => 0,
                    'monster_names' => array_values(array_map(fn ($row) => $row['monster_name'], $fallbackMonsterCards)),
                ];
            } else {
                $fallbackMonsterLinks = $this->extractMonsterLinksByKeywordBlock($articleBody, $crawler->getUri());

                if (!empty($fallbackMonsterLinks)) {
                    $monsterCount = count($fallbackMonsterLinks);

                    foreach ($fallbackMonsterLinks as $url => $name) {
                        $monsterSpawns[] = [
                            'monster_name' => $name,
                            'monster_url' => $url,
                            'layer_name' => $currentLayerName ?: '地上',
                            'area' => null,
                            'spawn_time' => 'normal',
                            'note' => null,
                        ];
                    }

                    $sectionDebug[] = [
                        'heading' => '[fallback 生息モンスター keyword block]',
                        'resolved_layer_name' => $currentLayerName ?: '地上',
                        'map_images' => count($layers),
                        'monster_links' => $monsterCount,
                        'monster_spawns' => count($fallbackMonsterLinks),
                        'map_links' => 0,
                        'monster_names' => array_values($fallbackMonsterLinks),
                    ];
                }
            }
        }

        $allMapLinks = $this->extractAllMapLinksFromPage($crawler, $crawler->getUri());
        foreach ($allMapLinks as $link) {
            $mapLinks[$this->normalizeUrlKey($link['url'])] = $link;
        }

        if (empty($layers)) {
            $fallbackImageUrls = $this->extractMapImagesFromSection($crawler);

            foreach ($fallbackImageUrls as $idx => $imageUrl) {
                $fallbackLayerName = count($fallbackImageUrls) > 1 ? 'layer' . ($idx + 1) : '地上';

                $layers[] = [
                    'layer_name' => $this->normalizeLayerKey($fallbackLayerName),
                    'floor_no' => count($fallbackImageUrls) > 1 ? 0 : 1,
                    'display_order' => $displayOrder++,
                    'image_url' => $imageUrl,
                ];
            }

            if (!empty($fallbackImageUrls)) {
                $sectionDebug[] = [
                    'heading' => '[fallback page-wide images]',
                    'resolved_layer_name' => '地上',
                    'map_images' => count($fallbackImageUrls),
                    'monster_links' => $monsterCount,
                    'monster_spawns' => count($monsterSpawns),
                    'map_links' => count($mapLinks),
                ];
            }
        }

        $sectionDebug[] = [
            'heading' => '[page-wide map links]',
            'resolved_layer_name' => null,
            'map_images' => count($layers),
            'monster_links' => $monsterCount,
            'monster_spawns' => count($monsterSpawns),
            'map_links' => count($mapLinks),
            'map_link_names' => array_values(array_map(fn ($row) => $row['name'], $mapLinks)),
        ];

        $layers = $this->dedupeLayers($layers);
        $monsterSpawns = $this->dedupeMonsterSpawns($monsterSpawns);

        if (count($layers) === 1) {
            $layers[0]['display_order'] = 1;
            if (empty($layers[0]['layer_name'])) {
                $layers[0]['layer_name'] = '地上';
                $layers[0]['floor_no'] = 1;
            }
        }

        return [
            'layers' => $layers,
            'monster_count' => $monsterCount,
            'monster_spawns' => $monsterSpawns,
            'map_links' => array_values($mapLinks),
            'section_debug' => $sectionDebug,
        ];
    }

    private function printDryRun(
        array $entry,
        string $mapName,
        int $mapId,
        array $layerPayloads,
        int $monsterCount,
        array $sectionDebug,
        array $mapLinks,
        array $monsterSpawns = []
    ): void {
        $this->newLine();
        $this->line(str_repeat('=', 90));
        $this->info('[dry-run] ' . $mapName);
        $this->line('map_id: ' . $mapId);
        $this->line('URL: ' . $entry['url']);
        $this->line('depth: ' . ($entry['depth'] ?? 0));
        $this->line('discovered_from: ' . (($entry['discovered_from'] ?? null) ?: '-'));
        $this->line('monster_count: ' . $monsterCount);
        $this->line('monster_spawn_count: ' . count($monsterSpawns));
        $this->line('layer_count: ' . count($layerPayloads));
        $this->line('map_link_count: ' . count($mapLinks));

        $this->newLine();
        $this->comment('map_layers payloads');
        $this->line(json_encode($layerPayloads, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $this->newLine();
        $this->comment('monster_map_spawns payloads');
        $this->line(json_encode($monsterSpawns, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $this->newLine();
        $this->comment('layer summary');
        foreach ($layerPayloads as $i => $row) {
            $this->line(sprintf(
                '#%d layer_name=%s floor_no=%s display_order=%s image_url=%s',
                $i + 1,
                var_export($row['layer_name'], true),
                var_export($row['floor_no'], true),
                var_export($row['display_order'], true),
                $row['image_url'] ?? ''
            ));
        }

        $this->newLine();
        $this->comment('map links discovered');
        $this->line(json_encode($mapLinks, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $this->newLine();
        $this->comment('section debug');
        $this->line(json_encode($sectionDebug, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
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

    private function sectionLooksLikeMonsterSection(Crawler $section, string $heading = ''): bool
    {
        if ($heading !== '' && mb_stripos($heading, '生息モンスター') !== false) {
            return true;
        }

        $text = $this->normalizeText($section->text(''));
        if ($text !== '' && mb_stripos($text, '生息モンスター') !== false) {
            return true;
        }

        if ($section->filter('ul.RpCardList')->count() > 0) {
            return true;
        }

        if ($section->filter('li.RpCard')->count() > 0) {
            return true;
        }

        if ($section->filter('.RpCard_TitleName a[href]')->count() > 0) {
            return true;
        }

        if ($section->filter('a[href*="/monster/"]')->count() >= 2) {
            return true;
        }

        return false;
    }

    private function extractMonsterLinksByKeywordBlock(Crawler $root, string $baseUri): array
    {
        $names = [];

        foreach ($root as $node) {
            $text = $this->normalizeText($node->textContent ?? '');
            if ($text === '' || mb_stripos($text, '生息モンスター') === false) {
                continue;
            }

            $block = new Crawler($node, $baseUri);

            $block->filter('a[href]')->each(function (Crawler $a) use (&$names) {
                $name = $this->normalizeText($a->text(''));
                $href = trim((string) $a->attr('href'));

                if ($href === '') {
                    return;
                }

                $url = $this->absoluteUrl($href);

                if (!Str::contains($url, '/monster/')) {
                    return;
                }

                if ($name === '') {
                    $name = $this->inferMonsterNameFromUrl($url);
                }

                if ($name === '') {
                    return;
                }

                $names[$url] = $name;
            });

            if (!empty($names)) {
                return $names;
            }
        }

        return $names;
    }

    private function extractMapImagesFromSection(Crawler $section): array
    {
        $urls = [];

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

            $section->filter($selector)->each(function (Crawler $img) use (&$urls) {
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

                    $abs = $this->absoluteUrl($src);
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

                    $abs = $this->absoluteUrl($rawUrl);
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

    private function extractAllMapLinksFromPage(Crawler $root, string $baseUri): array
    {
        $links = [];

        $root->filter('a[href], area[href]')->each(function (Crawler $node) use (&$links, $baseUri) {
            $href = trim((string) $node->attr('href'));
            if ($href === '') {
                return;
            }

            if (Str::startsWith($href, ['#', 'javascript:'])) {
                return;
            }

            $url = $this->absoluteUrl($href, $baseUri);
            $urlKey = $this->normalizeUrlKey($url);

            if (!Str::startsWith($url, $this->baseUrl . '/map/')) {
                return;
            }

            if ($urlKey === rtrim($this->indexUrl, '/')) {
                return;
            }

            if ($urlKey === $this->normalizeUrlKey($baseUri)) {
                return;
            }

            $name = $this->normalizeText($node->text(''));

            if ($name === '') {
                $name = $this->normalizeText((string) $node->attr('title'));
            }

            if ($name === '') {
                $name = $this->normalizeText((string) $node->attr('aria-label'));
            }

            if ($name === '' && $node->nodeName() === 'a' && $node->filter('img')->count()) {
                $img = $node->filter('img')->first();
                $name = $this->normalizeText((string) $img->attr('alt'));

                if ($name === '') {
                    $name = $this->normalizeText((string) $img->attr('title'));
                }
            }

            if ($name === '') {
                $name = $this->inferMapNameFromHrefOrUrl($href, $url);
            }

            $name = $this->cleanMapName($name);

            if ($name === '' || $name === '全体MAP') {
                return;
            }

            if ($this->looksLikeContinent($name)) {
                return;
            }

            $links[$urlKey] = [
                'url' => $url,
                'name' => $name,
                'continent' => '不明',
            ];
        });

        return array_values($links);
    }

    private function extractMonsterCardsFromSection(Crawler $section, string $layerName = '地上'): array
    {
        $rows = [];

        $cards = $section->filter('li.RpCard, .RpCardList > li');
        if ($cards->count() === 0) {
            return $rows;
        }

        $layerName = $this->normalizeLayerKey($layerName);

        $cards->each(function (Crawler $card) use (&$rows, $layerName) {
            $monsterName = '';
            $monsterUrl = null;

            if ($card->filter('.RpCard_TitleName a')->count()) {
                $a = $card->filter('.RpCard_TitleName a')->first();
                $monsterName = $this->normalizeText($a->text(''));
                $href = trim((string) $a->attr('href'));
                $monsterUrl = $href !== '' ? $this->absoluteUrl($href) : null;
            }

            if ($monsterName === '') {
                return;
            }

            $spawnText = $this->extractRpCardPropertyValue($card, '出現');
            $spawnText = $spawnText !== '' ? $spawnText : null;

            $spawnTime = $this->parseSpawnTime($spawnText);

            $rows[] = [
                'monster_name' => $monsterName,
                'monster_url' => $monsterUrl,
                'layer_name' => $layerName ?: '地上',
                'area' => $this->parseAreaFromSpawnText($spawnText),
                'spawn_time' => $spawnTime,
                'note' => $spawnText,
            ];
        });

        return $rows;
    }

    private function extractRpCardPropertyValue(Crawler $card, string $headerLabel): string
    {
        foreach ($card->filter('.RpCard_Property') as $node) {
            $prop = new Crawler($node, $card->getUri());

            $header = $this->normalizeText(
                $prop->filter('.RpCard_Property_Header')->count()
                    ? $prop->filter('.RpCard_Property_Header')->first()->text('')
                    : ''
            );

            if ($header !== $headerLabel) {
                continue;
            }

            $value = $this->normalizeText(
                $prop->filter('.RpCard_Property_Value')->count()
                    ? $prop->filter('.RpCard_Property_Value')->first()->text('')
                    : ''
            );

            return $value;
        }

        return '';
    }

    private function parseAreaFromSpawnText(?string $text): ?array
    {
        if ($text === null) {
            return null;
        }

        $text = $this->normalizeText($text);
        if ($text === '') {
            return null;
        }

        preg_match_all('/([A-H])\s*([1-8])/iu', $text, $matches, PREG_SET_ORDER);

        $cells = [];
        foreach ($matches as $m) {
            $cells[] = strtoupper($m[1]) . $m[2];
        }

        $cells = array_values(array_unique($cells));
        if (!empty($cells)) {
            return $cells;
        }

        $directionCells = $this->convertDirectionTextToAreaCells($text);
        if (!empty($directionCells)) {
            return $directionCells;
        }

        return null;
    }

    private function convertDirectionTextToAreaCells(string $text): array
    {
        $map = [
            '北東' => ['F2', 'F3', 'G2', 'G3'],
            '北西' => ['B2', 'B3', 'C2', 'C3'],
            '南東' => ['F6', 'F7', 'G6', 'G7'],
            '南西' => ['B6', 'B7', 'C6', 'C7'],
            '中央' => ['D4', 'D5', 'E4', 'E5'],
            '中部' => ['D4', 'D5', 'E4', 'E5'],
            '中心' => ['D4', 'D5', 'E4', 'E5'],
            '北' => ['D2', 'D3', 'E2', 'E3'],
            '南' => ['D6', 'D7', 'E6', 'E7'],
            '東' => ['F4', 'F5', 'G4', 'G5'],
            '西' => ['B4', 'B5', 'C4', 'C5'],
        ];

        foreach ($map as $keyword => $cells) {
            if (mb_stripos($text, $keyword) !== false) {
                return $cells;
            }
        }

        return [];
    }

    private function resolveMonsterSectionLayerName(Crawler $section, string $heading, string $fallback = '地上'): string
    {
        $text = $this->normalizeText($heading . ' ' . $section->text(''));

        $detected = $this->detectLayerNameFromText($text);
        if ($detected !== null) {
            return $detected;
        }

        return $fallback ?: '地上';
    }

    private function detectLayerNameFromText(string $text): ?string
    {
        $text = $this->normalizeText($text);

        if ($text === '') {
            return null;
        }

        if (preg_match('/地下\s*[0-9]+\s*階/u', $text, $m)) {
            return preg_replace('/\s+/u', '', $m[0]);
        }

        if (preg_match('/(?:^|[^下])([0-9]+)\s*階/u', $text, $m)) {
            return $m[1] . '階';
        }

        foreach (['上層', '中層', '下層', '屋上', '入口', '内部', '外観', '全体図', '裏通り', '駅', '参道'] as $word) {
            if (mb_stripos($text, $word) !== false) {
                return $word;
            }
        }

        if (mb_stripos($text, 'MAP') !== false) {
            return '地上';
        }

        return null;
    }

    private function inferMonsterNameFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';
        $segments = array_values(array_filter(explode('/', trim($path, '/'))));
        if (empty($segments)) {
            return '';
        }

        $last = end($segments);
        $last = urldecode((string) $last);
        $last = preg_replace('/\.php$/u', '', $last);

        return $this->normalizeText((string) $last);
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

    private function dedupeMonsterSpawns(array $rows): array
    {
        $unique = [];

        foreach ($rows as $row) {
            $monsterName = trim((string) ($row['monster_name'] ?? ''));
            $layerName = $this->normalizeLayerKey((string) ($row['layer_name'] ?? '地上'));
            $spawnTime = trim((string) ($row['spawn_time'] ?? 'normal')) ?: 'normal';

            $area = $row['area'] ?? null;
            if (is_array($area)) {
                sort($area);
            }

            $key = implode('|', [
                $monsterName,
                $layerName,
                $spawnTime,
                is_array($area) ? json_encode($area, JSON_UNESCAPED_UNICODE) : '',
            ]);

            if (!isset($unique[$key])) {
                $row['layer_name'] = $layerName;
                $unique[$key] = $row;
            }
        }

        return array_values($unique);
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

        if (preg_match('/^layer([0-9]+)$/iu', $layerName, $m)) {
            return 'layer' . $m[1];
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

        if (preg_match('/^layer([0-9]+)$/u', $layerName, $m)) {
            return (int) $m[1];
        }

        return 1;
    }

    private function resolveSavedMapLayer(array $savedLayersByName, Map $map, ?string $layerName): ?MapLayer
    {
        $normalized = $this->normalizeLayerKey($layerName);

        if (isset($savedLayersByName[$normalized])) {
            return $savedLayersByName[$normalized];
        }

        $floorNo = $this->parseFloorNo($normalized);

        $query = MapLayer::query()->where('map_id', $map->id);

        $byName = (clone $query)->where('layer_name', $normalized)->orderBy('id')->first();
        if ($byName) {
            return $byName;
        }

        $byFloor = (clone $query)->where('floor_no', $floorNo)->orderBy('id')->first();
        if ($byFloor) {
            return $byFloor;
        }

        if ($normalized === '地上') {
            $defaultGround = (clone $query)->orderBy('display_order')->orderBy('id')->first();
            if ($defaultGround) {
                return $defaultGround;
            }
        }

        return null;
    }

    private function guessMapTypeFromName(string $mapName): string
    {
        $mapName = $this->cleanMapName($mapName);

        if ($mapName === '') {
            return 'unknown';
        }

        if ($this->looksLikeContinent($mapName)) {
            return 'unknown';
        }

        $dungeonKeywords = [
            '洞くつ', '洞窟', '地下', '遺跡', '塔', '迷宮', '神殿', '廃坑',
            '墓', '牢獄', '坑道', '回廊', '樹洞', '祠', '監獄', '地下道',
            '魔窟', '本丸', '旧坑', 'ねぐら', '穴', '火口', '岩穴', '廃墟',
            '井戸の中', '井戸'
        ];

        $fieldKeywords = [
            '平原', '草原', '高原', '湿原', '雪原', '砂漠', '森', '林道',
            '山道', '山地', '海岸', '岬', '半島', '荒野', '原野',
            '台地', '沼', '湖', '川', '峡谷', '島', '街道'
        ];

        $townKeywords = [
            '村', '町', '街', '都', '城', '港', '宿', '酒場', '教会', '駅',
            'バザー', '素材屋', '道具屋', '武器屋', '防具屋', '預かり所', '郵便局',
            '門', '門前', '城門'
        ];

        if ($this->containsAny($mapName, $dungeonKeywords)) {
            return 'dungeon';
        }

        if ($this->containsAny($mapName, $fieldKeywords)) {
            return 'field';
        }

        if ($this->containsAny($mapName, $townKeywords)) {
            return 'town';
        }

        return 'field';
    }

    private function containsAny(string $text, array $keywords): bool
    {
        foreach ($keywords as $keyword) {
            if (mb_stripos($text, $keyword) !== false) {
                return true;
            }
        }

        return false;
    }

    private function findExistingLayerForImport(int $mapId, ?string $layerName, int $floorNo): ?MapLayer
    {
        $layerName = $this->normalizeLayerKey($layerName);

        $query = MapLayer::query()->where('map_id', $mapId);

        $byName = (clone $query)->where('layer_name', $layerName)->orderBy('id')->first();
        if ($byName) {
            return $byName;
        }

        $byFloor = (clone $query)->where('floor_no', $floorNo)->orderBy('id')->first();
        if ($byFloor) {
            return $byFloor;
        }

        return null;
    }

    private function upsertMonsterMapSpawns(Map $map, array $savedLayersByName, array $monsterSpawns): void
    {
        if (!Schema::hasTable('monster_map_spawns')) {
            return;
        }

        foreach ($monsterSpawns as $spawn) {
            $monsterName = trim((string) ($spawn['monster_name'] ?? ''));
            if ($monsterName === '') {
                $this->debugLine('[SPAWN判定] SKIP monster_name empty');
                continue;
            }

            $monster = Monster::query()->where('name', $monsterName)->first();

            if (!$monster && !empty($spawn['monster_url'])) {
                $monsterFromUrl = $this->inferMonsterNameFromUrl((string) $spawn['monster_url']);
                if ($monsterFromUrl !== '') {
                    $monster = Monster::query()->where('name', $monsterFromUrl)->first();
                }
            }

            if (!$monster) {
                $this->warn(sprintf(
                    '  monster未登録のためspawn skip: name=%s / url=%s / layer=%s / note=%s',
                    $monsterName,
                    (string) ($spawn['monster_url'] ?? '-'),
                    (string) ($spawn['layer_name'] ?? '-'),
                    (string) ($spawn['note'] ?? '-')
                ));

                $this->debugLine(sprintf(
                    '[SPAWN結果] SKIP-MONSTER-NOT-FOUND monster=%s / map_id=%d / map_name=%s / requested_layer=%s',
                    $monsterName,
                    $map->id,
                    $map->name,
                    (string) ($spawn['layer_name'] ?? '地上')
                ));
                continue;
            }

            $rawLayerName = (string) ($spawn['layer_name'] ?? '地上');
            $layerName = $this->normalizeLayerKey($rawLayerName);
            $mapLayer = $this->resolveSavedMapLayer($savedLayersByName, $map, $layerName);

            $resolvedLayerName = $mapLayer?->layer_name ?? null;
            $resolvedFloorNo = $mapLayer?->floor_no ?? null;

            $this->debugLine(sprintf(
                '[LAYER解決] map_id=%d / map_name=%s / requested_layer=%s / resolved_layer_id=%s / resolved_layer_name=%s / floor_no=%s',
                $map->id,
                $map->name,
                $layerName,
                $mapLayer?->id ?? 'null',
                $resolvedLayerName ?? 'null',
                $resolvedFloorNo ?? 'null'
            ));

            $area = null;
            if (is_array($spawn['area'] ?? null)) {
                $area = array_values(array_unique(array_map('strval', $spawn['area'])));
                sort($area);
            }

            $newNote = trim((string) ($spawn['note'] ?? ''));
            $spawnTime = trim((string) ($spawn['spawn_time'] ?? 'normal')) ?: 'normal';

            $this->debugLine(sprintf(
                '[SPAWN判定] monster=%s / monster_id=%d / map_id=%d / map_name=%s / layer_id=%s / layer_name=%s / floor_no=%s / spawn_time=%s / area=%s / note=%s',
                $monster->name,
                $monster->id,
                $map->id,
                $map->name,
                $mapLayer?->id ?? 'null',
                $resolvedLayerName ?? $layerName,
                $resolvedFloorNo ?? 'null',
                $spawnTime,
                $this->stringifyArea($area),
                $newNote !== '' ? $newNote : 'null'
            ));

            $existingQuery = MonsterMapSpawn::query()
                ->where('monster_id', $monster->id)
                ->where('map_id', $map->id)
                ->where('spawn_time', $spawnTime);

            if ($mapLayer?->id) {
                $existingQuery->where('map_layer_id', $mapLayer->id);
            } else {
                $existingQuery->whereNull('map_layer_id');
            }

            $existing = $existingQuery->first();

            if ($existing) {
                $this->line(sprintf(
                    '  spawn既存skip: monster=%s / layer=%s / map_layer_id=%s / spawn_time=%s',
                    $monsterName,
                    $layerName,
                    $mapLayer?->id ?? 'null',
                    $spawnTime
                ));

                $this->debugLine(sprintf(
                    '[SPAWN結果] SKIP-EXISTS spawn_id=%d / monster=%s / monster_id=%d / map_id=%d / map_name=%s / map_layer_id=%s / spawn_time=%s',
                    $existing->id,
                    $monster->name,
                    $monster->id,
                    $map->id,
                    $map->name,
                    $mapLayer?->id ?? 'null',
                    $spawnTime
                ));
                continue;
            }

            $created = MonsterMapSpawn::query()->create([
                'monster_id' => $monster->id,
                'map_id' => $map->id,
                'map_layer_id' => $mapLayer?->id,
                'area' => $area ? json_encode($area, JSON_UNESCAPED_UNICODE) : null,
                'spawn_time' => $spawnTime,
                'note' => $newNote !== '' ? $newNote : null,
            ]);

            $this->line(sprintf(
                '  spawn作成: monster=%s / layer=%s / map_layer_id=%s / spawn_time=%s / note=%s',
                $monsterName,
                $layerName,
                $mapLayer?->id ?? 'null',
                $spawnTime,
                $created->note ?? '-'
            ));

            $this->debugLine(sprintf(
                '[SPAWN結果] CREATE spawn_id=%d / monster=%s / monster_id=%d / map_id=%d / map_name=%s / map_layer_id=%s / spawn_time=%s',
                $created->id,
                $monster->name,
                $monster->id,
                $map->id,
                $map->name,
                $mapLayer?->id ?? 'null',
                $spawnTime
            ));
        }
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
            if (Str::startsWith($url, './') || Str::startsWith($url, '../') || !Str::startsWith($url, '/')) {
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

    private function inferMapNameFromHrefOrUrl(string $href, string $url): string
    {
        $candidate = trim($href);

        if ($candidate !== '' && !Str::startsWith($candidate, ['http://', 'https://', '/', '#'])) {
            $candidate = preg_replace('/^\.\//', '', $candidate);
            $candidate = preg_replace('/^\.\.\//', '', $candidate);
            $candidate = urldecode($candidate);
            $candidate = preg_replace('/\.php$/u', '', $candidate);
            $candidate = trim((string) $candidate, '/');

            if ($candidate !== '') {
                return $this->cleanMapName($candidate);
            }
        }

        return $this->inferMapNameFromUrl($url);
    }

    private function inferMapNameFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';
        $path = trim($path);

        if ($path === '') {
            return '';
        }

        $segments = array_values(array_filter(explode('/', trim($path, '/'))));
        if (empty($segments)) {
            return '';
        }

        $last = end($segments);

        if ($last === 'map') {
            return '';
        }

        $name = urldecode((string) $last);
        $name = preg_replace('/\.php$/u', '', $name);

        return $this->cleanMapName((string) $name);
    }

    private function normalizeUrlKey(string $url): string
    {
        return rtrim($url, '/');
    }

    private function looksLikeContinent(string $text): bool
    {
        return Str::contains($text, [
            '大陸',
            '諸島',
            'レンダーシア',
            'ナドラガンド',
            '魔界',
            '天星郷',
            '時の王者',
            '過去世界',
        ]);
    }

    private function cleanMapName(string $name): string
    {
        $name = preg_replace('/\s*\(Ver[^\)]*\)\s*/u', '', $name);
        $name = preg_replace('/\s*\(飛竜\)\s*/u', '', $name);
        $name = preg_replace('/\s*\(破界篇で解放\)\s*/u', '', $name);
        $name = preg_replace('/^\s*【/u', '', $name);
        $name = preg_replace('/】\s*$/u', '', $name);
        $name = preg_replace('/\.php$/u', '', $name);
        $name = preg_replace('/^\s*・/u', '', $name);
        $name = preg_replace('/\s+/u', ' ', $name);

        return trim((string) $name);
    }

    private function normalizeText(string $text): string
    {
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/u', ' ', $text);

        return trim((string) $text);
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

    private function parseSpawnTime(?string $text): string
    {
        $text = $this->normalizeText((string) $text);

        if ($text === '') {
            return 'normal';
        }

        if (preg_match('/夜/u', $text)) {
            return 'night';
        }

        if (preg_match('/日中|昼/u', $text)) {
            return 'day';
        }

        return 'normal';
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

        if (preg_match('/^layer([0-9]+)$/u', $layerName, $m)) {
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

    private function debugEnabled(): bool
    {
        return true;
    }

    private function debugLine(string $message): void
    {
        if (!$this->debugEnabled()) {
            return;
        }

        $this->line($message);
    }

    private function stringifyArea($area): string
    {
        if (is_array($area)) {
            return json_encode(array_values($area), JSON_UNESCAPED_UNICODE);
        }

        if ($area === null || $area === '') {
            return 'null';
        }

        return (string) $area;
    }
}