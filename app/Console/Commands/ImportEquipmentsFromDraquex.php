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

    protected $description = 'Import equipments from draquex list/detail pages and merge with craft_master.csv';

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

    protected array $itemNameToIdMap = [];
    protected array $equipmentTypeNameToIdMap = [];
    protected array $jobNameToIdMap = [];
    protected array $defaultJobsByEquipmentTypeId = [];

    public function handle(): int
    {
        $targets = $this->resolveTargets();

        if (empty($targets)) {
            $this->error('対象が見つからない');
            return self::FAILURE;
        }

        $this->itemNameToIdMap = $this->loadItemsMap();
        $this->equipmentTypeNameToIdMap = $this->loadEquipmentTypeMap();
        $this->jobNameToIdMap = $this->loadJobMap();
        $this->defaultJobsByEquipmentTypeId = $this->loadDefaultJobsByEquipmentTypeId();

        $csvMap = $this->loadCraftMasterCsv();

        if ($this->option('fresh')) {
            $this->freshDelete($targets);
        }

        foreach ($targets as $key => $target) {
            $listUrl = $target['url'];
            $rawType = $target['type'];

            $this->info("fetch list: {$listUrl}");

            $html = $this->fetch($listUrl);
            if (!$html) {
                $this->error("failed list: {$listUrl}");
                continue;
            }

            $items = $this->parseList($html, $listUrl, $rawType, $key);

            $this->info("found: " . count($items));

            foreach ($items as $index => $item) {
                $this->line(sprintf(
                    '[%d/%d] %s %s',
                    $index + 1,
                    count($items),
                    $item['item_id'],
                    $item['item_name']
                ));

                $detailHtml = $this->fetch($item['detail_url']);

                $detail = [
                    'craft_level' => null,
                    'equip_level' => $item['equip_level'],
                    'recipe_book' => null,
                    'recipe_place' => null,
                    'description' => null,
                    'jobs' => [],
                    'materials' => [],
                    'effects' => [],
                ];

                if (!$detailHtml) {
                    $this->warn("failed detail: {$item['detail_url']} (list情報だけ保存する)");
                } else {
                    try {
                        $detail = $this->parseDetail($detailHtml, $rawType);
                    } catch (\Throwable $e) {
                        $this->warn("parse detail failed: {$item['detail_url']} / {$e->getMessage()}");
                    }
                }

                $csv = $this->findCsvRow($csvMap, $item['item_name'], $rawType, $item['equip_level']);

                $equipmentTypeName = $this->resolveEquipmentTypeName(
                    $rawType,
                    $csv,
                    $detail,
                    $item['equipment_type_name'] ?? null
                );
                $equipmentTypeId = $this->equipmentTypeNameToIdMap[$equipmentTypeName] ?? null;

                if (!$equipmentTypeId) {
                    $this->warn("equipment_types 未登録: {$item['item_name']} / {$equipmentTypeName}");
                }

                $rawMaterials = $this->resolveRawMaterials($csv, $detail);
                $materialsWithIds = $this->convertMaterialsToItemIds($rawMaterials, $item['item_name']);

                $desiredJobs = $this->resolveDesiredJobs($csv, $detail);
                $desiredJobs = $this->normalizeJobNames($desiredJobs);

                $jobOverrideMode = $this->resolveJobOverrideMode($equipmentTypeId, $desiredJobs);

                $payload = [
                    'item_id'            => $item['item_id'],
                    'item_name'          => $item['item_name'],
                    'equipment_type_id'  => $equipmentTypeId,
                    'job_override_mode'  => $jobOverrideMode,

                    'slot'               => $this->csvValue($csv, 'slot', $equipmentTypeName),
                    'slot_grid_type'     => $this->csvValue($csv, 'slotGridType', null),
                    'slot_grid_cols'     => $this->csvNumericValue($csv, 'slotGridCols', null),
                    'group_kind'         => $this->csvValue($csv, 'groupKind', $rawType === '盾' ? 'shield' : 'weapon'),
                    'group_id'           => $this->csvValue($csv, 'groupId', null),
                    'group_name'         => $this->csvValue($csv, 'groupName', $item['item_name']),
                    'slot_grid_json'     => $this->csvJsonValue($csv, 'slotGridJson', null),

                    'craft_level'        => $this->csvNumericValue($csv, 'craftLevel', $detail['craft_level']),
                    'equip_level'        => $this->csvNumericValue($csv, 'equipLevel', $detail['equip_level'] ?? $item['equip_level']),
                    'recipe_book'        => $this->csvValue($csv, 'recipeBook', $detail['recipe_book']),
                    'recipe_place'       => $detail['recipe_place'],
                    'description'        => $detail['description'],
                    'materials_json'     => $this->toJsonOrNull($materialsWithIds),
                    'effects_json'       => $this->toJsonOrNull($detail['effects']),

                    'source_url'         => $listUrl,
                    'detail_url'         => $item['detail_url'],
                    'updated_at'         => now(),
                ];

                $existing = DB::table('equipments')
                    ->select('id')
                    ->where('detail_url', $item['detail_url'])
                    ->first();

                if ($existing) {
                    DB::table('equipments')
                        ->where('id', $existing->id)
                        ->update($payload);

                    $equipmentId = (int) $existing->id;
                    $this->syncJobOverrides($equipmentId, $equipmentTypeId, $desiredJobs);

                    $this->info("updated: {$item['item_name']}");
                } else {
                    $payload['created_at'] = now();
                    $equipmentId = DB::table('equipments')->insertGetId($payload);

                    $this->syncJobOverrides($equipmentId, $equipmentTypeId, $desiredJobs);

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

    private function freshDelete(array $targets): void
    {
        $isAllTargets = count($targets) === count($this->urls);

        if ($isAllTargets) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            DB::table('equipment_job_overrides')->truncate();
            DB::table('equipments')->truncate();
            DB::statement('SET FOREIGN_KEY_CHECKS=1');

            $this->warn('truncate equipments + equipment_job_overrides: id reset to 1');
            return;
        }

        foreach ($targets as $key => $target) {
            $typeNames = $this->targetEquipmentTypeNames($target['type']);
            $typeIds = [];

            foreach ($typeNames as $typeName) {
                if (isset($this->equipmentTypeNameToIdMap[$typeName])) {
                    $typeIds[] = $this->equipmentTypeNameToIdMap[$typeName];
                }
            }

            if (empty($typeIds)) {
                $this->warn("equipment_types が見つからないので削除スキップ: {$target['type']}");
                continue;
            }

            $equipmentIds = DB::table('equipments')
                ->whereIn('equipment_type_id', $typeIds)
                ->pluck('id')
                ->map(fn ($v) => (int) $v)
                ->all();

            if (!empty($equipmentIds)) {
                DB::table('equipment_job_overrides')
                    ->whereIn('equipment_id', $equipmentIds)
                    ->delete();
            }

            $deleted = DB::table('equipments')
                ->whereIn('equipment_type_id', $typeIds)
                ->delete();

            $this->warn("deleted {$deleted} rows: {$target['type']}");
        }

        if (DB::table('equipments')->count() === 0) {
            DB::statement('ALTER TABLE equipments AUTO_INCREMENT = 1');
            $this->warn('equipments is empty: auto_increment reset to 1');
        } else {
            $this->warn('partial deleteなので id は1からには戻らない');
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

private function parseList(string $html, string $baseUrl, string $itemType, string $typeKey): array
{
    libxml_use_internal_errors(true);

    $dom = new \DOMDocument();
    $dom->loadHTML('<?xml encoding="UTF-8">' . mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));

    $xpath = new \DOMXPath($dom);

    if ($itemType === '盾') {
        return $this->parseShieldList($xpath, $baseUrl, $typeKey);
    }

    $nodes = $xpath->query('//section[contains(@class,"item")]//ul/li/a[contains(@class,"arrow")]');

    $items = [];
    $sameLevelCounts = [];

    foreach ($nodes as $a) {
        $parsed = $this->parseEquipmentAnchor($xpath, $a, $baseUrl, $typeKey);

        if (!$parsed) {
            continue;
        }

        $equipLevel = $parsed['equip_level'];
        $sameLevelCounts[$equipLevel] = ($sameLevelCounts[$equipLevel] ?? 0) + 1;
        $parsed['item_id'] = $this->buildItemId($typeKey, $equipLevel, $sameLevelCounts[$equipLevel]);

        $items[] = $parsed;
    }

    return $items;
}
private function parseShieldList(\DOMXPath $xpath, string $baseUrl, string $typeKey): array
{
    $items = [];
    $sameLevelCounts = [];

    $h2Nodes = $xpath->query('//h2');

    foreach ($h2Nodes as $h2) {
        $heading = trim(preg_replace('/\s+/u', ' ', $h2->textContent));

        $shieldType = null;

        if (mb_strpos($heading, '小盾一覧') !== false) {
            $shieldType = '小盾';
        } elseif (mb_strpos($heading, '大盾一覧') !== false) {
            $shieldType = '大盾';
        }

        if (!$shieldType) {
            continue;
        }

        $section = $this->findNextElementSiblingByTagAndClass($h2, 'section', 'item');
        if (!$section) {
            $this->warn("盾セクションが見つからない: {$heading}");
            continue;
        }

        $anchors = $xpath->query('.//ul/li/a[contains(@class,"arrow")]', $section);

        foreach ($anchors as $a) {
            $parsed = $this->parseEquipmentAnchor($xpath, $a, $baseUrl, $typeKey);

            if (!$parsed) {
                continue;
            }

            $equipLevel = $parsed['equip_level'];
            $sameLevelCounts[$equipLevel] = ($sameLevelCounts[$equipLevel] ?? 0) + 1;
            $parsed['item_id'] = $this->buildItemId($typeKey, $equipLevel, $sameLevelCounts[$equipLevel]);
            $parsed['equipment_type_name'] = $shieldType;

            $items[] = $parsed;
        }
    }

    return $items;
}
private function parseEquipmentAnchor(\DOMXPath $xpath, \DOMNode $a, string $baseUrl, string $typeKey): ?array
{
    $href = trim((string) $a->getAttribute('href'));
    if ($href === '') {
        return null;
    }

    $p = $xpath->query('.//p[contains(@class,"name")]', $a)->item(0);
    if (!$p) {
        return null;
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
        return null;
    }

    return [
        'item_name' => $itemName,
        'equip_level' => $equipLevel,
        'detail_url' => $this->absoluteUrl($baseUrl, $href),
    ];
}
private function findNextElementSiblingByTagAndClass(\DOMNode $node, string $tagName, ?string $className = null): ?\DOMElement
{
    $sibling = $node->nextSibling;

    while ($sibling) {
        if ($sibling->nodeType === XML_ELEMENT_NODE) {
            $tag = strtolower($sibling->nodeName);

            if ($tag === strtolower($tagName)) {
                if ($className === null) {
                    return $sibling;
                }

                $classAttr = ' ' . trim((string) $sibling->attributes?->getNamedItem('class')?->nodeValue) . ' ';
                if (str_contains($classAttr, ' ' . $className . ' ')) {
                    return $sibling;
                }
            }
        }

        $sibling = $sibling->nextSibling;
    }

    return null;
}
private function detectShieldTypeFromAnchor(\DOMNode $node, \DOMXPath $xpath): ?string
{
    $current = $node;

    while ($current) {
        $sibling = $current->previousSibling;

        while ($sibling) {
            if ($sibling->nodeType === XML_ELEMENT_NODE) {
                $tag = strtolower($sibling->nodeName);

                if ($tag === 'h2') {
                    $text = trim(preg_replace('/\s+/u', ' ', $sibling->textContent));

                    if (mb_strpos($text, '小盾一覧') !== false || mb_strpos($text, '小盾') !== false) {
                        return '小盾';
                    }

                    if (mb_strpos($text, '大盾一覧') !== false || mb_strpos($text, '大盾') !== false) {
                        return '大盾';
                    }
                }

                $found = $this->findLastH2InNode($sibling);
                if ($found !== null) {
                    return $found;
                }
            }

            $sibling = $sibling->previousSibling;
        }

        $current = $current->parentNode;
    }

    return null;
}

private function findLastH2InNode(\DOMNode $node): ?string
{
    if (!$node->hasChildNodes()) {
        return null;
    }

    for ($i = $node->childNodes->length - 1; $i >= 0; $i--) {
        $child = $node->childNodes->item($i);

        if ($child->nodeType !== XML_ELEMENT_NODE) {
            continue;
        }

        $tag = strtolower($child->nodeName);

        if ($tag === 'h2') {
            $text = trim(preg_replace('/\s+/u', ' ', $child->textContent));

            if (mb_strpos($text, '小盾一覧') !== false || mb_strpos($text, '小盾') !== false) {
                return '小盾';
            }

            if (mb_strpos($text, '大盾一覧') !== false || mb_strpos($text, '大盾') !== false) {
                return '大盾';
            }
        }

        $nested = $this->findLastH2InNode($child);
        if ($nested !== null) {
            return $nested;
        }
    }

    return null;
}

    private function parseDetail(string $html, string $itemType): array
    {
        libxml_use_internal_errors(true);

        $result = [
            'craft_level' => null,
            'equip_level' => null,
            'recipe_book' => null,
            'recipe_place' => null,
            'description' => null,
            'jobs' => [],
            'materials' => [],
            'effects' => [],
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
                $result['jobs'] = array_values(array_filter(array_map('trim', $jobs)));
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
                $result['effects'] = array_values(array_filter($this->extractLinesFromTd($tdNode)));
                continue;
            }

            if ($this->isDescriptionRow($thNode, $tdNode)) {
                $result['description'] = $this->cleanDescription($tdNode, $itemType);
                continue;
            }
        }

        $result['jobs'] = array_values(array_unique($result['jobs']));
        $result['effects'] = array_values(array_unique($result['effects']));

        return $result;
    }

    private function isDescriptionRow(\DOMNode $thNode, \DOMNode $tdNode): bool
    {
        $thHtml = $thNode->ownerDocument->saveHTML($thNode);
        $tdText = trim(preg_replace('/\s+/u', ' ', $tdNode->textContent));

        return stripos($thHtml, '<img') !== false && $tdText !== '';
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

        return implode(' ', $lines);
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

    private function loadItemsMap(): array
    {
        return DB::table('items')
            ->select('id', 'name')
            ->get()
            ->mapWithKeys(function ($row) {
                return [trim((string) $row->name) => (int) $row->id];
            })
            ->all();
    }

    private function loadEquipmentTypeMap(): array
    {
        return DB::table('equipment_types')
            ->select('id', 'name')
            ->get()
            ->mapWithKeys(function ($row) {
                return [trim((string) $row->name) => (int) $row->id];
            })
            ->all();
    }

    private function loadJobMap(): array
    {
        return DB::table('game_jobs')
            ->select('id', 'name')
            ->get()
            ->mapWithKeys(function ($row) {
                return [trim((string) $row->name) => (int) $row->id];
            })
            ->all();
    }

    private function loadDefaultJobsByEquipmentTypeId(): array
    {
        $rows = DB::table('equipable_types')
            ->join('game_jobs', 'equipable_types.game_job_id', '=', 'game_jobs.id')
            ->select('equipable_types.equipment_type_id', 'game_jobs.name')
            ->get();

        $map = [];

        foreach ($rows as $row) {
            $equipmentTypeId = (int) $row->equipment_type_id;
            $jobName = trim((string) $row->name);

            $map[$equipmentTypeId] ??= [];
            $map[$equipmentTypeId][] = $jobName;
        }

        foreach ($map as $equipmentTypeId => $jobs) {
            $jobs = array_values(array_unique($jobs));
            sort($jobs);
            $map[$equipmentTypeId] = $jobs;
        }

        return $map;
    }

    private function resolveRawMaterials(?array $csv, array $detail): array
    {
        if ($csv) {
            $csvMaterials = $this->csvMaterialsToArray($csv);
            if (!empty($csvMaterials)) {
                return $csvMaterials;
            }
        }

        return $detail['materials'] ?? [];
    }

    private function csvMaterialsToArray(?array $csv): array
    {
        if (!$csv || !array_key_exists('materialsJson', $csv)) {
            return [];
        }

        $raw = trim((string) $csv['materialsJson']);
        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);

        if (!is_array($decoded)) {
            return [];
        }

        $materials = [];

        foreach ($decoded as $row) {
            if (!is_array($row)) {
                continue;
            }

            $name = trim((string) ($row['name'] ?? $row['itemName'] ?? ''));
            $count = $row['count'] ?? $row['qty'] ?? $row['num'] ?? null;

            if ($name === '') {
                continue;
            }

            $materials[] = [
                'name' => $name,
                'count' => is_numeric($count) ? (int) $count : 1,
            ];
        }

        return $materials;
    }

    private function convertMaterialsToItemIds(array $materials, string $equipmentName): array
    {
        $results = [];

        foreach ($materials as $material) {
            $name = trim((string) ($material['name'] ?? ''));
            $count = $material['count'] ?? $material['qty'] ?? 1;
            $count = is_numeric($count) ? (int) $count : 1;

            if ($name === '') {
                continue;
            }

            $itemId = $this->findItemIdByMaterialName($name);

            if ($itemId === null) {
                $this->warn("items未登録素材: {$equipmentName} / {$name}");

                $results[] = [
                    'item_id' => null,
                    'count' => $count,
                    'name' => $name,
                ];
                continue;
            }

            $results[] = [
                'item_id' => $itemId,
                'count' => $count,
            ];
        }

        return $results;
    }

    private function findItemIdByMaterialName(string $name): ?int
    {
        $normalizedCandidates = $this->materialNameCandidates($name);

        foreach ($normalizedCandidates as $candidate) {
            if (isset($this->itemNameToIdMap[$candidate])) {
                return $this->itemNameToIdMap[$candidate];
            }
        }

        return null;
    }

    private function materialNameCandidates(string $name): array
    {
        $name = trim($name);

        $candidates = [
            $name,
            str_replace('　', '', $name),
            preg_replace('/\s+/u', '', $name),
            preg_replace('/[・･]/u', '', $name),
        ];

        return array_values(array_unique(array_filter($candidates)));
    }

    private function loadCraftMasterCsv(): array
    {
        $path = $this->findCsvPath();

        if (!$path || !file_exists($path)) {
            $this->warn('craft_master.csv が見つからないので draquex のみで進める');
            return [];
        }

        $this->info("load csv: {$path}");

        $handle = fopen($path, 'r');
        if (!$handle) {
            $this->warn('csv open failed');
            return [];
        }

        $header = fgetcsv($handle);
        if (!$header) {
            fclose($handle);
            return [];
        }

        $map = [];

        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) !== count($header)) {
                continue;
            }

            $assoc = array_combine($header, $row);

            $itemName = trim((string) ($assoc['itemName'] ?? ''));
            $itemType = trim((string) ($assoc['itemType'] ?? ''));
            $equipLevel = trim((string) ($assoc['equipLevel'] ?? ''));

            if ($itemName === '') {
                continue;
            }

            $key1 = $this->csvKey($itemName, $itemType, $equipLevel);
            $key2 = $this->csvKey($itemName, $itemType, null);
            $key3 = $this->csvKey($itemName, null, null);

            $map[$key1] = $assoc;
            $map[$key2] = $assoc;
            $map[$key3] = $assoc;
        }

        fclose($handle);

        return $map;
    }

    private function findCsvPath(): ?string
    {
        $paths = [
            storage_path('app/craft_master.csv'),
            base_path('craft_master.csv'),
            public_path('craft_master.csv'),
        ];

        foreach ($paths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        return null;
    }

    private function findCsvRow(array $csvMap, string $itemName, string $itemType, ?int $equipLevel): ?array
    {
        $keys = [
            $this->csvKey($itemName, $itemType, $equipLevel),
            $this->csvKey($itemName, $itemType, null),
            $this->csvKey($itemName, null, null),
        ];

        foreach ($keys as $key) {
            if (isset($csvMap[$key])) {
                return $csvMap[$key];
            }
        }

        return null;
    }

    private function csvKey(?string $itemName, ?string $itemType, $equipLevel): string
    {
        return trim((string) $itemName) . '|' . trim((string) $itemType) . '|' . trim((string) $equipLevel);
    }

    private function csvValue(?array $csv, string $key, $default = null)
    {
        if (!$csv || !array_key_exists($key, $csv)) {
            return $default;
        }

        $value = trim((string) $csv[$key]);

        return $value === '' ? $default : $value;
    }

    private function csvNumericValue(?array $csv, string $key, $default = null)
    {
        if (!$csv || !array_key_exists($key, $csv)) {
            return $default;
        }

        $value = trim((string) $csv[$key]);

        if ($value === '') {
            return $default;
        }

        if (is_numeric($value)) {
            return str_contains($value, '.') ? (float) $value : (int) $value;
        }

        return $default;
    }

    private function csvJsonValue(?array $csv, string $key, $default = null)
    {
        if (!$csv || !array_key_exists($key, $csv)) {
            return $default;
        }

        $value = trim((string) $csv[$key]);

        return $value === '' ? $default : $value;
    }

    private function buildItemId(string $typeKey, ?int $equipLevel, int $index): string
    {
        $prefix = $this->itemIdPrefix($typeKey);
        $level = $equipLevel ?? 0;

        if ($index <= 1) {
            return "{$prefix}_{$level}";
        }

        return "{$prefix}_{$level}_{$index}";
    }

    private function itemIdPrefix(string $typeKey): string
    {
        return match ($typeKey) {
            'katate' => 'katateken',
            'taiken' => 'taiken',
            'tanken' => 'tanken',
            'yari'   => 'yari',
            'ono'    => 'ono',
            'hanma'  => 'hanma',
            'tsume'  => 'tsume',
            'muchi'  => 'muchi',
            'bume'   => 'boomerang',
            'sti'    => 'stick',
            'tsue'   => 'ryoutesue',
            'kon'    => 'kon',
            'ougi'   => 'ougi',
            'yumi'   => 'yumi',
            'kama'   => 'kama',
            'tate'   => 'tate',
            default  => $typeKey,
        };
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

private function resolveEquipmentTypeName(
    string $rawType,
    ?array $csv,
    array $detail,
    ?string $listDetectedType = null
): string {
    $csvType = $this->csvValue($csv, 'itemType', null);
    if ($csvType) {
        return $this->normalizeEquipmentTypeName($csvType);
    }

    if ($listDetectedType) {
        return $this->normalizeEquipmentTypeName($listDetectedType);
    }

    return $this->normalizeEquipmentTypeName($rawType);
}

    private function normalizeEquipmentTypeName(string $name): string
    {
        $name = trim($name);

        return match ($name) {
            '盾' => '小盾',
            '武道家装備' => '武闘家装備',
            default => $name,
        };
    }

    private function guessShieldTypeFromJobs(array $jobs): string
    {
        $jobs = $this->normalizeJobNames($jobs);

        $largeShieldJobs = ['戦士', 'パラディン', '魔法戦士', '魔剣士', 'ガーディアン'];
        sort($largeShieldJobs);

        $normalized = array_values(array_unique(array_filter($jobs)));
        sort($normalized);

        if (!empty($normalized) && $normalized === $largeShieldJobs) {
            return '大盾';
        }

        return '小盾';
    }

    private function resolveDesiredJobs(?array $csv, array $detail): array
    {
        $csvJobs = $this->csvJobsToArray($csv);
        if (!empty($csvJobs)) {
            return $csvJobs;
        }

        return $detail['jobs'] ?? [];
    }

    private function csvJobsToArray(?array $csv): array
    {
        if (!$csv || !array_key_exists('jobsJson', $csv)) {
            return [];
        }

        $raw = trim((string) $csv['jobsJson']);
        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);

        if (!is_array($decoded)) {
            return [];
        }

        $jobs = [];

        foreach ($decoded as $row) {
            if (is_string($row)) {
                $jobs[] = trim($row);
                continue;
            }

            if (is_array($row)) {
                $name = trim((string) ($row['name'] ?? $row['job'] ?? ''));
                if ($name !== '') {
                    $jobs[] = $name;
                }
            }
        }

        return array_values(array_unique(array_filter($jobs)));
    }

    private function normalizeJobNames(array $jobs): array
    {
        $normalized = [];

        foreach ($jobs as $job) {
            $job = trim((string) $job);
            if ($job === '') {
                continue;
            }

            $job = match ($job) {
                '魔法' => '魔法使い',
                '魔法戦士(スキル)' => '魔法戦士',
                default => $job,
            };

            $normalized[] = $job;
        }

        $normalized = array_values(array_unique($normalized));
        sort($normalized);

        return $normalized;
    }

    private function resolveJobOverrideMode(?int $equipmentTypeId, array $desiredJobs): string
    {
        if (!$equipmentTypeId || empty($desiredJobs)) {
            return 'inherit';
        }

        $defaultJobs = $this->defaultJobsByEquipmentTypeId[$equipmentTypeId] ?? [];
        $defaultJobs = $this->normalizeJobNames($defaultJobs);

        if ($defaultJobs === $desiredJobs) {
            return 'inherit';
        }

        return 'add';
    }

    private function syncJobOverrides(int $equipmentId, ?int $equipmentTypeId, array $desiredJobs): void
    {
        DB::table('equipment_job_overrides')
            ->where('equipment_id', $equipmentId)
            ->delete();

        if (!$equipmentTypeId || empty($desiredJobs)) {
            return;
        }

        $defaultJobs = $this->defaultJobsByEquipmentTypeId[$equipmentTypeId] ?? [];
        $defaultJobs = $this->normalizeJobNames($defaultJobs);

        if ($defaultJobs === $desiredJobs) {
            return;
        }

        $desiredSet = array_flip($desiredJobs);
        $defaultSet = array_flip($defaultJobs);

        $allowJobs = array_values(array_diff($desiredJobs, $defaultJobs));
        $denyJobs = array_values(array_diff($defaultJobs, $desiredJobs));

        $rows = [];

        foreach ($allowJobs as $jobName) {
            $jobId = $this->jobNameToIdMap[$jobName] ?? null;

            if (!$jobId) {
                $this->warn("game_jobs 未登録(allow): {$jobName}");
                continue;
            }

            $rows[] = [
                'equipment_id' => $equipmentId,
                'game_job_id' => $jobId,
                'mode' => 'allow',
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        foreach ($denyJobs as $jobName) {
            $jobId = $this->jobNameToIdMap[$jobName] ?? null;

            if (!$jobId) {
                $this->warn("game_jobs 未登録(deny): {$jobName}");
                continue;
            }

            $rows[] = [
                'equipment_id' => $equipmentId,
                'game_job_id' => $jobId,
                'mode' => 'deny',
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if (!empty($rows)) {
            DB::table('equipment_job_overrides')->insert($rows);
        }
    }

    private function targetEquipmentTypeNames(string $targetType): array
    {
        if ($targetType === '盾') {
            return ['小盾', '大盾'];
        }

        return [$targetType];
    }
}