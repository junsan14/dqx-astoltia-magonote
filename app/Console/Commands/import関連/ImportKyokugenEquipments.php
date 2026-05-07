<?php

namespace App\Console\Commands;

use DOMDocument;
use DOMNode;
use DOMXPath;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class ImportKyokugenEquipments extends Command
{
    protected $signature = 'import:kyokugen-equipments
                            {--page=all : all, armor, weapon, shield, head, body_top, body_bottom, arms, feet, one_handed_sword, two_handed_sword, dagger, stick, staff, spear, axe, club, claw, whip, fan, hammer, boomerang, bow, scythe}
                            {--limit= : Import limit for testing}
                            {--sleep=300 : Sleep milliseconds between detail requests}
                            {--dry-run : Do not save to DB}
                            {--show-links : Show all extracted detail links}';

    protected $description = 'Import only equipment stats from Kyokugen detail pages';

    private string $baseUrl = 'https://xn--10-yg4a1a3kyh.jp';

    private array $listPages = [
        [
            'key' => 'head',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_01.html',
            'group_kind' => 'armor',
            'slot' => 'head',
            'equipment_type_name' => '頭',
        ],
        [
            'key' => 'body_top',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_02.html',
            'group_kind' => 'armor',
            'slot' => 'body_top',
            'equipment_type_name' => '体上',
        ],
        [
            'key' => 'body_bottom',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_03.html',
            'group_kind' => 'armor',
            'slot' => 'body_bottom',
            'equipment_type_name' => '体下',
        ],
        [
            'key' => 'arms',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_04.html',
            'group_kind' => 'armor',
            'slot' => 'arms',
            'equipment_type_name' => '腕',
        ],
        [
            'key' => 'feet',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_05.html',
            'group_kind' => 'armor',
            'slot' => 'feet',
            'equipment_type_name' => '足',
        ],

        [
            'key' => 'one_handed_sword',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_01.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => '片手剣',
        ],
        [
            'key' => 'two_handed_sword',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_02.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => '両手剣',
        ],
        [
            'key' => 'dagger',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_03.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => '短剣',
        ],
        [
            'key' => 'stick',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_04.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => 'スティック',
        ],
        [
            'key' => 'staff',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_05.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => '両手杖',
        ],
        [
            'key' => 'spear',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_06.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => 'ヤリ',
        ],
        [
            'key' => 'axe',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_07.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => 'オノ',
        ],
        [
            'key' => 'club',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_08.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => '棍',
        ],
        [
            'key' => 'claw',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_09.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => 'ツメ',
        ],
        [
            'key' => 'whip',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_10.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => 'ムチ',
        ],
        [
            'key' => 'fan',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_11.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => '扇',
        ],
        [
            'key' => 'hammer',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_12.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => 'ハンマー',
        ],
        [
            'key' => 'boomerang',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_13.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => 'ブーメラン',
        ],
        [
            'key' => 'bow',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_14.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => '弓',
        ],
        [
            'key' => 'scythe',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_15.html',
            'group_kind' => 'weapon',
            'slot' => 'weapon',
            'equipment_type_name' => '鎌',
        ],

        [
            'key' => 'shield',
            'url' => 'https://xn--10-yg4a1a3kyh.jp/a_tate/dq10_tate_l_00.html',
            'group_kind' => 'shield',
            'slot' => 'shield',
            'equipment_type_name' => '盾',
        ],
    ];

    private array $statColumns = [
        'attack',
        'defense',
        'max_hp',
        'max_mp',
        'charm',
        'agility',
        'dexterity',
        'magic_attack',
        'healing_power',
        'weight',
    ];

    public function handle(): int
    {
        $pageOption = (string) $this->option('page');
        $limit = $this->option('limit') ? (int) $this->option('limit') : null;
        $sleepMs = (int) $this->option('sleep');
        $dryRun = (bool) $this->option('dry-run');
        $showLinks = (bool) $this->option('show-links');

        $pages = $this->filterListPages($pageOption);

        if (empty($pages)) {
            $this->error("Unknown --page={$pageOption}");
            $this->line('Available pages: all, armor, weapon, shield, head, body_top, body_bottom, arms, feet, one_handed_sword, two_handed_sword, dagger, stick, staff, spear, axe, club, claw, whip, fan, hammer, boomerang, bow, scythe');
            return self::FAILURE;
        }

        $this->info('Import started.');
        $this->line('Mode: ' . ($dryRun ? 'DRY RUN' : 'DB UPDATE'));
        $this->line("Page option: {$pageOption}");
        $this->line('Update columns only: ' . implode(', ', $this->statColumns));

        $this->newLine();
        $this->line('Target list pages:');

        foreach ($pages as $page) {
            $this->line("  - {$page['key']} / {$page['equipment_type_name']} / {$page['url']}");
        }

        $detailTargets = [];

        foreach ($pages as $page) {
            $this->newLine();
            $this->line("<fg=blue>Fetching list:</> {$page['key']} / {$page['equipment_type_name']}");
            $this->line("  URL: {$page['url']}");

            try {
                $html = $this->fetchHtml($page['url']);
                $links = $this->extractDetailLinks($html, $page['url'], $page);

                foreach ($links as $link) {
                    $detailTargets[$link['detail_url']] = $link;
                }

                $this->line('  Found detail links: ' . count($links));

                if ($showLinks) {
                    foreach ($links as $link) {
                        $this->line("    - {$link['item_name_from_list']} -> {$link['detail_url']}");
                    }
                }
            } catch (Throwable $e) {
                $this->error("  Failed list page: {$page['url']}");
                $this->error("  {$e->getMessage()}");
            }
        }

        $detailTargets = array_values($detailTargets);

        if ($limit) {
            $detailTargets = array_slice($detailTargets, 0, $limit);
        }

        $total = count($detailTargets);

        $this->newLine();
        $this->info("Detail pages to import: {$total}");

        $updated = 0;
        $noChanges = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($detailTargets as $index => $target) {
            $current = $index + 1;

            $this->newLine();
            $this->line("<fg=white>[{$current}/{$total}]</> Fetching detail:");
            $this->line("  {$target['detail_url']}");

            try {
                $html = $this->fetchHtml($target['detail_url']);
                $data = $this->parseDetailPage($html, $target);

                if (!$data['item_name']) {
                    $skipped++;
                    $this->warn("Skipped: item name not found / {$target['detail_url']}");
                    continue;
                }

                $result = $dryRun
                    ? $this->printDryRunData($data)
                    : $this->saveEquipmentWithLog($data);

                if ($result === 'updated') {
                    $updated++;
                } elseif ($result === 'no_changes') {
                    $noChanges++;
                } else {
                    $skipped++;
                }
            } catch (Throwable $e) {
                $failed++;
                $this->error("Failed: {$target['detail_url']}");
                $this->error($e->getMessage());
            }

            if ($sleepMs > 0 && $current < $total) {
                usleep($sleepMs * 1000);
            }
        }

        $this->newLine();
        $this->info("Updated/Will update: {$updated}");
        $this->info("No changes: {$noChanges}");
        $this->info("Skipped: {$skipped}");
        $this->info("Failed: {$failed}");

        if ($dryRun) {
            $this->warn('Dry run mode: DB was not changed.');
        }

        return self::SUCCESS;
    }

    private function filterListPages(string $pageOption): array
    {
        if ($pageOption === 'all') {
            return $this->listPages;
        }

        if (in_array($pageOption, ['armor', 'weapon', 'shield'], true)) {
            return array_values(array_filter(
                $this->listPages,
                fn ($page) => $page['group_kind'] === $pageOption
            ));
        }

        return array_values(array_filter(
            $this->listPages,
            fn ($page) => $page['key'] === $pageOption
        ));
    }

    private function fetchHtml(string $url): string
    {
        $response = Http::timeout(20)
            ->retry(2, 500)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 DQX Tools Importer',
                'Accept-Language' => 'ja,en;q=0.8',
            ])
            ->get($url);

        if (!$response->successful()) {
            throw new \RuntimeException("HTTP {$response->status()}");
        }

        return $response->body();
    }

    private function extractDetailLinks(string $html, string $sourceUrl, array $page): array
    {
        $dom = $this->createDom($html);
        $xpath = new DOMXPath($dom);

        $links = [];

        foreach ($xpath->query('//a[@href]') as $a) {
            $href = trim($a->getAttribute('href'));
            $name = $this->cleanText($a->textContent);

            if (!$href || !$name) {
                continue;
            }

            $absoluteUrl = $this->toAbsoluteUrl($href, $sourceUrl);

            if (!$this->isEquipmentDetailUrl($absoluteUrl)) {
                continue;
            }

            $links[$absoluteUrl] = [
                'item_name_from_list' => $name,
                'detail_url' => $absoluteUrl,
                'source_url' => $sourceUrl,
                'group_kind' => $page['group_kind'],
                'slot' => $page['slot'],
                'equipment_type_name' => $page['equipment_type_name'],
            ];
        }

        return array_values($links);
    }

    private function isEquipmentDetailUrl(string $url): bool
    {
        return preg_match('/\/a_bogu\/dq10_bogu_k_[^\/]+\.html$/u', $url)
            || preg_match('/\/a_buki\/dq10_buki_k_[^\/]+\.html$/u', $url)
            || preg_match('/\/a_tate\/dq10_tate_k_[^\/]+\.html$/u', $url);
    }

    private function parseDetailPage(string $html, array $target): array
    {
        $dom = $this->createDom($html);

        $itemName = $this->extractItemNameFromDom($dom, $target['item_name_from_list']);
        $basicInfo = $this->extractBasicInfoTable($dom);

        return [
            'item_id' => $this->makeItemId($target['detail_url']),
            'item_name' => $itemName,

            'attack' => $this->toIntOrNull($basicInfo['こうげき力'] ?? null),
            'defense' => $this->toIntOrNull($basicInfo['しゅび力'] ?? null),
            'max_hp' => $this->toIntOrNull($basicInfo['さいだいＨＰ'] ?? $basicInfo['さいだいHP'] ?? null),
            'max_mp' => $this->toIntOrNull($basicInfo['さいだいＭＰ'] ?? $basicInfo['さいだいMP'] ?? null),
            'charm' => $this->toIntOrNull($basicInfo['おしゃれさ'] ?? null),
            'agility' => $this->toIntOrNull($basicInfo['すばやさ'] ?? null),
            'dexterity' => $this->toIntOrNull($basicInfo['きようさ'] ?? null),
            'magic_attack' => $this->toIntOrNull($basicInfo['こうげき魔力'] ?? null),
            'healing_power' => $this->toIntOrNull($basicInfo['かいふく魔力'] ?? null),
            'weight' => $this->toIntOrNull($basicInfo['おもさ'] ?? null),
        ];
    }

    private function extractBasicInfoTable(DOMDocument $dom): array
    {
        $xpath = new DOMXPath($dom);

        $heading = $xpath->query('//h2[contains(normalize-space(.), "基本情報")]')->item(0);

        if (!$heading) {
            return [];
        }

        $table = $xpath
            ->query('following::table[contains(concat(" ", normalize-space(@class), " "), " table1 ")]', $heading)
            ->item(0);

        if (!$table) {
            return [];
        }

        $labels = [
            '種別',
            '部位',
            '装備レベル',
            'こうげき力',
            'しゅび力',
            'さいだいＨＰ',
            'さいだいHP',
            'さいだいＭＰ',
            'さいだいMP',
            'おしゃれさ',
            'すばやさ',
            'きようさ',
            'こうげき魔力',
            'かいふく魔力',
            'おもさ',
            '特殊効果',
            '備考',
        ];

        return $this->extractLabelValuePairsFromTable($xpath, $table, $labels);
    }

    private function extractLabelValuePairsFromTable(DOMXPath $xpath, DOMNode $table, array $labels): array
    {
        $result = [];

        foreach ($xpath->query('.//tr', $table) as $tr) {
            $cells = $xpath->query('./td|./th', $tr);
            $count = $cells->length;

            for ($i = 0; $i < $count; $i++) {
                $cell = $cells->item($i);
                $label = $this->cleanText($cell->textContent);

                if (!in_array($label, $labels, true)) {
                    continue;
                }

                $valueCell = $cells->item($i + 1);

                if (!$valueCell) {
                    $result[$label] = null;
                    continue;
                }

                $value = $this->cleanCellValue($valueCell);
                $result[$label] = $value !== '' ? $value : null;

                $i++;
            }
        }

        return $result;
    }

private function printDryRunData(array $data): string
{
    $existing = DB::table('equipments')
        ->where('item_name', $data['item_name'])
        ->first();

    $this->line("<fg=yellow>[DRY RUN]</> {$data['item_name']}");
    $this->line("  match by: item_name");

    if (!$existing) {
        $this->warn('  Skip: existing equipment not found by item_name. No row will be created.');
        return 'skipped';
    }

    $this->line("  existing id: {$existing->id}");
    $this->line("  existing item_id: " . ($existing->item_id ?? 'NULL'));

    $changes = $this->getChangedColumns($data, $existing);

    if (empty($changes)) {
        $this->line("  <fg=green>No changes</>");
        return 'no_changes';
    }

    foreach ($changes as $column => $change) {
        $this->line("  <fg=cyan>{$column}</>: {$change['old']} => {$change['new']}");
    }

    return 'updated';
}
private function saveEquipmentWithLog(array $data): string
{
    $existing = DB::table('equipments')
        ->where('item_name', $data['item_name'])
        ->first();

    $this->line("<fg=blue>Checking:</> {$data['item_name']}");
    $this->line("  match by: item_name");

    if (!$existing) {
        $this->warn('  Skip: existing equipment not found by item_name. No row was created.');
        return 'skipped';
    }

    $this->line("  existing id: {$existing->id}");
    $this->line("  existing item_id: " . ($existing->item_id ?? 'NULL'));

    $changes = $this->getChangedColumns($data, $existing);

    if (empty($changes)) {
        $this->line("  <fg=green>No changes</>");
        return 'no_changes';
    }

    $this->line("<fg=blue>Updating stats only:</> {$data['item_name']}");

    foreach ($changes as $column => $change) {
        $this->line("  <fg=cyan>{$column}</>: {$change['old']} => {$change['new']}");
    }

    $this->saveEquipmentStatsOnly($existing->id, $data);

    $this->line("<fg=green>Updated:</> {$data['item_name']}");

    return 'updated';
}

private function saveEquipmentStatsOnly(int $equipmentId, array $data): void
{
    DB::table('equipments')
        ->where('id', $equipmentId)
        ->update([
            'attack' => $data['attack'],
            'defense' => $data['defense'],
            'max_hp' => $data['max_hp'],
            'max_mp' => $data['max_mp'],
            'charm' => $data['charm'],
            'agility' => $data['agility'],
            'dexterity' => $data['dexterity'],
            'magic_attack' => $data['magic_attack'],
            'healing_power' => $data['healing_power'],
            'weight' => $data['weight'],
        ]);
}

    private function getChangedColumns(array $data, object $existing): array
    {
        $changes = [];

        foreach ($this->statColumns as $column) {
            $newValue = $data[$column] ?? null;
            $oldValue = $existing->{$column} ?? null;

            if ($this->normalizeForCompare($oldValue) === $this->normalizeForCompare($newValue)) {
                continue;
            }

            $changes[$column] = [
                'old' => $this->formatLogValue($oldValue),
                'new' => $this->formatLogValue($newValue),
            ];
        }

        return $changes;
    }

    private function normalizeForCompare($value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_string($value)) {
            return trim($value);
        }

        return (string) $value;
    }

    private function formatLogValue($value): string
    {
        if ($value === null || $value === '') {
            return 'NULL';
        }

        return (string) $value;
    }

    private function createDom(string $html): DOMDocument
    {
        libxml_use_internal_errors(true);

        $dom = new DOMDocument();

        $converted = mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8');
        $dom->loadHTML($converted);

        libxml_clear_errors();

        return $dom;
    }

    private function cleanText(?string $text): string
    {
        $text = (string) $text;
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace(["\r\n", "\r", "\n", "\t"], ' ', $text);
        $text = preg_replace('/[ 　]+/u', ' ', $text);

        return trim($text);
    }

    private function cleanCellValue(DOMNode $node): string
    {
        $html = '';

        foreach ($node->childNodes as $child) {
            $html .= $node->ownerDocument->saveHTML($child);
        }

        $html = preg_replace('/<br\s*\/?>/iu', "\n", $html);
        $html = strip_tags($html);
        $html = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $html = str_replace(["\r\n", "\r"], "\n", $html);
        $html = preg_replace('/[ \t　]+/u', ' ', $html);
        $html = preg_replace('/\n[ \t　]+/u', "\n", $html);
        $html = preg_replace('/[ \t　]+\n/u', "\n", $html);
        $html = preg_replace('/\n{2,}/u', "\n", $html);

        return trim($html);
    }

    private function extractItemNameFromDom(DOMDocument $dom, string $fallback): string
    {
        $xpath = new DOMXPath($dom);

        $heading = $xpath->query('//h2[contains(normalize-space(.), "基本情報")]')->item(0);

        if ($heading) {
            $text = $this->cleanText($heading->textContent);
            $text = preg_replace('/の基本情報$/u', '', $text);

            if ($text !== '') {
                return $text;
            }
        }

        return $fallback;
    }

    private function toIntOrNull($value): ?int
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        if (preg_match('/[0-9]+/u', $value, $m)) {
            return (int) $m[0];
        }

        return null;
    }

    private function makeItemId(string $detailUrl): string
    {
        $url = $this->normalizeUrl($detailUrl);
        $path = parse_url($url, PHP_URL_PATH);
        $filename = pathinfo($path, PATHINFO_FILENAME);

        return Str::slug($filename, '_');
    }

    private function toAbsoluteUrl(string $href, string $currentUrl): string
    {
        if (str_starts_with($href, 'http://') || str_starts_with($href, 'https://')) {
            return $this->normalizeUrl($href);
        }

        if (str_starts_with($href, '//')) {
            return $this->normalizeUrl('https:' . $href);
        }

        if (str_starts_with($href, '/')) {
            return $this->normalizeUrl($this->baseUrl . $href);
        }

        $base = preg_replace('/\/[^\/]*$/', '/', $currentUrl);

        return $this->normalizeUrl($base . $href);
    }

    private function normalizeUrl(string $url): string
    {
        $parts = parse_url($url);

        if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
            return $url;
        }

        $path = $parts['path'] ?? '/';
        $segments = [];

        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }

            if ($segment === '..') {
                array_pop($segments);
                continue;
            }

            $segments[] = $segment;
        }

        $normalized = $parts['scheme'] . '://' . $parts['host'] . '/' . implode('/', $segments);

        if (!empty($parts['query'])) {
            $normalized .= '?' . $parts['query'];
        }

        return $normalized;
    }
}