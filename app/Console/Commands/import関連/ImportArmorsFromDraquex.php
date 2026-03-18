<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ImportArmorsFromDraquex extends Command
{
    protected $signature = 'dq10:import-armors-draquex
                            {--fresh : equipments を空にして id を1から入れ直す}
                            {--limit= : 先頭nセットだけ試す}';

    protected $description = 'Import armor set pages from draquex and save each part as a record';

    protected string $listUrl = 'https://draquex.com/bougu/0-zenbu.php';

    protected array $itemNameToIdMap = [];
    protected array $equipmentTypeNameToIdMap = [];
    protected array $jobNameToIdMap = [];
    protected array $defaultJobsByEquipmentTypeId = [];

    public function handle(): int
    {
        $this->itemNameToIdMap = $this->loadItemsMap();
        $this->equipmentTypeNameToIdMap = $this->loadEquipmentTypeMap();
        $this->jobNameToIdMap = $this->loadJobMap();
        $this->defaultJobsByEquipmentTypeId = $this->loadDefaultJobsByEquipmentTypeId();

        $csvMap = $this->loadCraftMasterCsv();

        if ($this->option('fresh')) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            DB::table('equipment_job_overrides')->truncate();
            DB::table('equipments')->truncate();
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
            $this->warn('truncate equipments + equipment_job_overrides: id reset to 1');
        }

        $html = $this->fetch($this->listUrl);
        if (!$html) {
            $this->error("failed list: {$this->listUrl}");
            return self::FAILURE;
        }

        $sets = $this->parseArmorSetList($html, $this->listUrl);

        $limit = (int) $this->option('limit');
        if ($limit > 0) {
            $sets = array_slice($sets, 0, $limit);
        }

        $this->info('found sets: ' . count($sets));

        foreach ($sets as $index => $set) {
            $this->line(sprintf('[%d/%d] %s', $index + 1, count($sets), $set['set_name']));

            $detailHtml = $this->fetch($set['detail_url']);

            if (!$detailHtml) {
                $this->warn("failed detail: {$set['detail_url']} (このセットは一覧情報だけでは部位展開できないのでskip)");
                continue;
            }

            try {
                $detail = $this->parseArmorDetail($detailHtml, $set['set_name'], $set['detail_url']);
            } catch (\Throwable $e) {
                $this->warn("parse armor detail failed: {$set['detail_url']} / {$e->getMessage()}");
                continue;
            }

            foreach ($detail['parts'] as $part) {
                $csv = $this->findCsvRow(
                    $csvMap,
                    $part['item_name'],
                    $part['slot'],
                    $detail['equip_level']
                );

                $craftType = $this->csvValue($csv, 'craftType', $part['craft_type'] ?? '防具鍛冶');
                $itemId = $this->buildArmorItemId($part, $detail, $craftType);

                $rawMaterials = $this->resolveRawMaterials($csv, $part['materials']);
                $materialsWithIds = $this->convertMaterialsToItemIds($rawMaterials, $part['item_name']);

                $typeKey = $this->slotTypeKey($part['slot']);
                
                $desiredJobs = $this->resolveDesiredJobs($csv, $detail);
                $desiredJobs = $this->normalizeJobNames($desiredJobs);
                $equipmentTypeName = $this->resolveArmorEquipmentTypeName(
                    $csv,
                    $part,
                    $craftType,
                    $desiredJobs
                );
                $equipmentTypeId = $this->equipmentTypeNameToIdMap[$equipmentTypeName] ?? null;

                if (!$equipmentTypeId) {
                    $this->warn("equipment_types 未登録: {$part['item_name']} / {$equipmentTypeName}");
                }



                $jobOverrideMode = $this->resolveJobOverrideMode($equipmentTypeId, $desiredJobs);

                $payload = [
                    'item_id'            => $itemId,
                    'item_name'          => $part['item_name'],
                    'equipment_type_id'  => $equipmentTypeId,
                    'job_override_mode'  => $jobOverrideMode,

                    'craft_level'        => $this->csvNumericValue($csv, 'craftLevel', $part['craft_level']),
                    'equip_level'        => $this->csvNumericValue($csv, 'equipLevel', $detail['equip_level']),
                    'recipe_book'        => $this->csvValue($csv, 'recipeBook', $detail['recipe_book']),
                    'recipe_place'       => $detail['recipe_place'],
                    'description'        => null,

                    'slot'               => $this->csvValue($csv, 'slot', $part['slot']),
                    'slot_grid_type'     => $this->csvValue($csv, 'slotGridType', $part['slot']),
                    'slot_grid_cols'     => $this->csvNumericValue($csv, 'slotGridCols', null),
                    'group_kind'         => $this->csvValue($csv, 'groupKind', 'armor_set'),
                    'group_id'           => $this->csvValue($csv, 'groupId', '防具_' . $detail['set_name']),
                    'group_name'         => $this->csvValue($csv, 'groupName', $detail['set_name']),
                    'materials_json'     => $this->toJsonOrNull($materialsWithIds),
                    'slot_grid_json'     => $this->csvJsonValue($csv, 'slotGridJson', null),

                    'source_url'         => $this->listUrl,
                    'detail_url'         => $part['detail_url'] ?: $detail['detail_url'],
                    'effects_json'       => $this->toJsonOrNull($detail['effects']),
                    'updated_at'         => now(),
                ];

                $existing = DB::table('equipments')
                    ->select('id')
                    ->where('detail_url', $payload['detail_url'])
                    ->first();

                if ($existing) {
                    DB::table('equipments')
                        ->where('id', $existing->id)
                        ->update($payload);

                    $equipmentId = (int) $existing->id;
                    $this->syncJobOverrides($equipmentId, $equipmentTypeId, $desiredJobs);

                    $this->info("updated: {$part['item_name']}");
                } else {
                    $payload['created_at'] = now();
                    $equipmentId = DB::table('equipments')->insertGetId($payload);

                    $this->syncJobOverrides($equipmentId, $equipmentTypeId, $desiredJobs);

                    $this->info("inserted: {$part['item_name']}");
                }
            }

            usleep(200000);
        }

        $this->info('done');
        return self::SUCCESS;
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

    private function parseArmorSetList(string $html, string $baseUrl): array
    {
        libxml_use_internal_errors(true);

        $dom = new \DOMDocument();
        $dom->loadHTML('<?xml encoding="UTF-8">' . mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
        $xpath = new \DOMXPath($dom);

        $nodes = $xpath->query('//a[contains(@href, "set-")]');

        $sets = [];
        $seen = [];

        foreach ($nodes as $a) {
            $href = trim((string) $a->getAttribute('href'));
            $name = trim(preg_replace('/\s+/u', ' ', $a->textContent));

            if ($href === '' || $name === '') {
                continue;
            }

            if (!str_contains($href, 'set-')) {
                continue;
            }

            $detailUrl = $this->absoluteUrl($baseUrl, $href);
            if (isset($seen[$detailUrl])) {
                continue;
            }

            $seen[$detailUrl] = true;

            $setName = preg_replace('/\s*\(.+$/u', '', $name);
            $setName = trim($setName);

            if ($setName === '' || in_array($setName, ['全防具･セット', 'アタマ', 'からだ上', 'からだ下', 'ウデ', '足'], true)) {
                continue;
            }

            $sets[] = [
                'set_name' => $setName,
                'detail_url' => $detailUrl,
            ];
        }

        return $sets;
    }

    private function parseArmorDetail(string $html, string $setName, string $detailUrl): array
    {
        libxml_use_internal_errors(true);

        $result = [
            'set_name' => $setName,
            'detail_url' => $detailUrl,
            'equip_level' => null,
            'jobs' => [],
            'effects' => [],
            'recipe_book' => null,
            'recipe_place' => null,
            'parts' => [],
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

            if ($thText === '装備可能な職業') {
                $tdText = trim(preg_replace('/\s+/u', ' ', $tdNode->textContent));
                $jobs = preg_split('/[･・、,\s]+/u', $tdText);
                $result['jobs'] = array_values(array_filter(array_map('trim', $jobs)));
                continue;
            }

            if ($thText === 'レシピの名前') {
                $tdText = trim(preg_replace('/\s+/u', ' ', $tdNode->textContent));
                $result['recipe_book'] = $tdText;
                continue;
            }

            if ($thText === 'レシピの場所') {
                $placeLines = $this->extractLinesFromTd($tdNode);

                $placeLines = array_values(array_filter($placeLines, function ($line) {
                    return !preg_match('/^[0-9,]+G$/u', $line);
                }));

                $result['recipe_place'] = $placeLines[0] ?? null;
                continue;
            }

            if ($thText === 'セット効果') {
                $result['effects'] = $this->extractLinesFromTd($tdNode);
                continue;
            }
        }

        $result['effects'] = array_values(array_unique(array_filter($result['effects'])));
        $result['jobs'] = array_values(array_unique($result['jobs']));

        foreach ($rows as $tr) {
            $thNode = $xpath->query('./th', $tr)->item(0);
            $tdNode = $xpath->query('./td', $tr)->item(0);

            if (!$thNode || !$tdNode) {
                continue;
            }

            $slot = $this->extractArmorSlotFromTh($thNode);
            if (!$slot) {
                continue;
            }

            $partName = $this->extractArmorPartNameFromTh($thNode);
            $partDetailUrl = $this->extractArmorPartDetailUrlFromTh($thNode, $detailUrl);
            $craftLevel = $this->extractArmorCraftLevelFromTh($thNode);
            $craftType = $this->guessArmorCraftTypeFromName($partName);
            $materials = $this->parseMaterialsFromTd($tdNode);

            $result['parts'][] = [
                'slot' => $slot,
                'item_name' => $partName ?: "{$setName}{$slot}",
                'detail_url' => $partDetailUrl,
                'craft_level' => $craftLevel,
                'craft_type' => $craftType,
                'materials' => $materials,
            ];
        }

        return $result;
    }

    private function extractArmorSlotFromTh(\DOMNode $thNode): ?string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $thNode->textContent));

        if (preg_match('/【\s*アタマ\s*】|〖\s*アタマ\s*〗/u', $text)) return 'アタマ';
        if (preg_match('/【\s*からだ上\s*】|〖\s*からだ上\s*〗/u', $text)) return 'からだ上';
        if (preg_match('/【\s*からだ下\s*】|〖\s*からだ下\s*〗/u', $text)) return 'からだ下';
        if (preg_match('/【\s*ウデ\s*】|〖\s*ウデ\s*〗/u', $text)) return 'ウデ';
        if (preg_match('/【\s*足\s*】|〖\s*足\s*〗/u', $text)) return '足';

        return null;
    }

    private function extractArmorPartNameFromTh(\DOMNode $thNode): ?string
    {
        $xpath = new \DOMXPath($thNode->ownerDocument);
        $node = $xpath->query('.//p[contains(@class,"side-txt")]', $thNode)->item(0);

        if (!$node) {
            return null;
        }

        $text = trim($node->textContent);
        $text = preg_replace('/\(.+?\)/u', '', $text);
        $text = preg_replace('/\s+/u', ' ', $text);

        return trim($text);
    }

    private function extractArmorPartDetailUrlFromTh(\DOMNode $thNode, string $baseUrl): ?string
    {
        $xpath = new \DOMXPath($thNode->ownerDocument);
        $a = $xpath->query('.//a[@href]', $thNode)->item(0);

        if (!$a) {
            return null;
        }

        $href = trim((string) $a->getAttribute('href'));
        if ($href === '') {
            return null;
        }

        return $this->absoluteUrl($baseUrl, $href);
    }

    private function extractArmorCraftLevelFromTh(\DOMNode $thNode): ?int
    {
        $text = trim(preg_replace('/\s+/u', ' ', $thNode->textContent));

        if (preg_match('/職人Lv\s*([0-9]+)\s*以上/u', $text, $m)) {
            return (int) $m[1];
        }

        return null;
    }

    private function guessArmorCraftTypeFromName(?string $name): string
    {
        $name = (string) $name;

        $tailorKeywords = [
            'ローブ', 'ころも', '服', 'ドレス', 'コート', 'スーツ',
            '帽子', 'ぼうし', 'ハット', 'キャップ', 'ターバン',
            'バンド', 'リスト', 'グローブ', 'こて', 'うであて',
            'くつ', 'ブーツ', 'シューズ', 'サンダル',
        ];

        foreach ($tailorKeywords as $keyword) {
            if ($keyword !== '' && str_contains($name, $keyword)) {
                return '裁縫';
            }
        }

        return '防具鍛冶';
    }

    private function buildArmorItemId(array $part, array $detail, string $craftType): string
    {
        $level = $detail['equip_level'] ?? 0;
        $prefix = $craftType === '裁縫' ? 'tailor' : 'armor';

        $slot = match ($part['slot']) {
            'アタマ' => 'head',
            'からだ上' => 'bodyup',
            'からだ下' => 'bodydown',
            'ウデ' => 'arm',
            '足' => 'foot',
            default => 'part',
        };

        $base = "{$prefix}_{$level}_{$slot}";
        $id = $base;
        $i = 2;

        while (DB::table('equipments')->where('item_id', $id)->exists()) {
            $id = "{$base}_{$i}";
            $i++;
        }

        return $id;
    }

    private function slotTypeKey(string $slot): string
    {
        return match ($slot) {
            'アタマ'   => 'armor_head',
            'からだ上' => 'armor_body_up',
            'からだ下' => 'armor_body_down',
            'ウデ'     => 'armor_arm',
            '足'       => 'armor_foot',
            default    => 'armor',
        };
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

    private function loadItemsMap(): array
    {
        return DB::table('items')
            ->select('id', 'name')
            ->get()
            ->mapWithKeys(fn ($row) => [trim((string) $row->name) => (int) $row->id])
            ->all();
    }

    private function loadEquipmentTypeMap(): array
    {
        return DB::table('equipment_types')
            ->select('id', 'name')
            ->get()
            ->mapWithKeys(fn ($row) => [trim((string) $row->name) => (int) $row->id])
            ->all();
    }

    private function loadJobMap(): array
    {
        return DB::table('game_jobs')
            ->select('id', 'name')
            ->get()
            ->mapWithKeys(fn ($row) => [trim((string) $row->name) => (int) $row->id])
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

    private function resolveRawMaterials(?array $csv, array $detailMaterials): array
    {
        if ($csv) {
            $csvMaterials = $this->csvMaterialsToArray($csv);
            if (!empty($csvMaterials)) {
                return $csvMaterials;
            }
        }

        return $detailMaterials;
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
        $candidates = $this->materialNameCandidates($name);

        foreach ($candidates as $candidate) {
            if (isset($this->itemNameToIdMap[$candidate])) {
                return $this->itemNameToIdMap[$candidate];
            }
        }

        return null;
    }

    private function materialNameCandidates(string $name): array
    {
        $name = trim($name);

        return array_values(array_unique(array_filter([
            $name,
            str_replace('　', '', $name),
            preg_replace('/\s+/u', '', $name),
            preg_replace('/[・･]/u', '', $name),
        ])));
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

            $map[$this->csvKey($itemName, $itemType, $equipLevel)] = $assoc;
            $map[$this->csvKey($itemName, $itemType, null)] = $assoc;
            $map[$this->csvKey($itemName, null, null)] = $assoc;
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
    private function guessArmorEquipmentTypeNameFromJobs(array $jobs): ?string
    {
        $jobs = $this->normalizeJobNames($jobs);
        $joined = implode(' ', $jobs);

        if ($this->containsAnyKeyword($joined, ['僧侶'])) {
            return 'ローブ';
        }

        if ($this->containsAnyKeyword($joined, ['盗賊'])) {
            return '盗賊装備';
        }

        if ($this->containsAnyKeyword($joined, ['旅芸', '旅芸人'])) {
            return '旅芸人装備';
        }

        if ($this->containsAnyKeyword($joined, ['武闘', '武闘家'])) {
            return '武闘家装備';
        }
        if ($this->containsAnyKeyword($joined, ['戦士'])) {
            return '鎧';
        }

        return null;
    }
    private function containsAnyKeyword(string $text, array $keywords): bool
{
    foreach ($keywords as $keyword) {
        if ($keyword !== '' && mb_strpos($text, $keyword) !== false) {
            return true;
        }
    }

    return false;
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

private function resolveArmorEquipmentTypeName(
    ?array $csv,
    array $part,
    string $craftType,
    array $desiredJobs = []
): string {
    $jobBasedType = $this->guessArmorEquipmentTypeNameFromJobs($desiredJobs);
    if ($jobBasedType !== null) {
        return $jobBasedType;
    }

    $csvType = $this->csvValue($csv, 'itemType', null);
    if ($csvType) {
        return $this->normalizeArmorEquipmentTypeName($csvType);
    }

    $slot = $part['slot'] ?? '';

    if ($craftType === '裁縫') {
        return match ($slot) {
            'アタマ'   => '裁縫頭',
            'からだ上' => '裁縫上',
            'からだ下' => '裁縫下',
            'ウデ'     => '裁縫腕',
            '足'       => '裁縫足',
            default    => $slot,
        };
    }

    return match ($slot) {
        'アタマ'   => '鎧頭',
        'からだ上' => '鎧上',
        'からだ下' => '鎧下',
        'ウデ'     => '鎧腕',
        '足'       => '鎧足',
        default    => $slot,
    };
}

    private function normalizeArmorEquipmentTypeName(string $name): string
    {
        $name = trim($name);

        return match ($name) {
            '頭' => '鎧頭',
            '上' => '鎧上',
            '下' => '鎧下',
            '腕' => '鎧腕',
            '足' => '鎧足',
            default => $name,
        };
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
                '魔戦' => '魔法戦士',
                '僧' => '僧侶',
                '武' => '武闘家',
                '盗' => '盗賊',
                '旅' => '旅芸人',
                'バト' => 'バトルマスター',
                'パラ' => 'パラディン',
                'レン' => 'レンジャー',
                '賢' => '賢者',
                'スパ' => 'スーパースター',
                'まも' => 'まもの使い',
                'どう' => 'どうぐ使い',
                '踊' => '踊り子',
                '占' => '占い師',
                '天地' => '天地雷鳴士',
                '遊' => '遊び人',
                'デス' => 'デスマスター',
                '魔剣' => '魔剣士',
                'ガデ' => 'ガーディアン',
                '竜術' => '竜術士',
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

        return 'replace';
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

        foreach ($desiredJobs as $jobName) {
            $jobId = $this->jobNameToIdMap[$jobName] ?? null;

            if (!$jobId) {
                $this->warn("game_jobs 未登録: {$jobName}");
                continue;
            }

            DB::table('equipment_job_overrides')->insert([
                'equipment_id' => $equipmentId,
                'game_job_id'  => $jobId,
                'mode'         => 'allow',
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }
    }
}