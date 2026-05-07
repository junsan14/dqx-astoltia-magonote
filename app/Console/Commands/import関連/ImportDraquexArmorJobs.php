<?php

namespace App\Console\Commands;

use DOMDocument;
use DOMXPath;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ImportDraquexArmorJobs extends Command
{
    protected $signature = 'import:draquex-armor-jobs
        {--url=https://draquex.com/bougu/0-zenbu.php}
        {--dry-run : DB更新せず確認だけ}
        {--match=both : item_name / group_name / both}';

    protected $description = 'Draquexの防具一覧から装備可能職業を抽出し、equipments の job_override_mode と equipment_job_overrides を更新する';

    private const JOB_ABBREVIATIONS = [
        '戦' => '戦士',
        '僧' => '僧侶',
        '魔' => '魔法使い',
        '武' => '武闘家',
        '盗' => '盗賊',
        '旅' => '旅芸人',
        'バ' => 'バトルマスター',
        'パ' => 'パラディン',
        'マ' => '魔法戦士',
        'レ' => 'レンジャー',
        '賢' => '賢者',
        'ス' => 'スーパースター',
        'ま' => 'まもの使い',
        '道' => 'どうぐ使い',
        '踊' => '踊り子',
        '占' => '占い師',
        '天' => '天地雷鳴士',
        '遊' => '遊び人',
        'デ' => 'デスマスター',
        '剣' => '魔剣士',
        '海' => '海賊',
        'ガ' => 'ガーディアン',
        '竜' => '竜術士',
        '隠' => '隠者',
    ];

    public function handle(): int
    {
        $url = (string) $this->option('url');
        $dryRun = (bool) $this->option('dry-run');
        $match = (string) $this->option('match');

        if (!in_array($match, ['item_name', 'group_name', 'both'], true)) {
            $this->error('--match は item_name / group_name / both のどれかにしてくれ');
            return self::FAILURE;
        }

        $this->info("URL: {$url}");
        $this->info('Mode: ' . ($dryRun ? 'DRY RUN' : 'UPDATE'));
        $this->info("Match: {$match}");

        $jobsByName = DB::table('game_jobs')
            ->select('id', 'key', 'name')
            ->get()
            ->keyBy('name');

        if ($jobsByName->isEmpty()) {
            $this->error('game_jobs が空です');
            return self::FAILURE;
        }

        $allJobIds = $jobsByName
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $missingJobNames = collect(self::JOB_ABBREVIATIONS)
            ->values()
            ->unique()
            ->filter(fn ($name) => !$jobsByName->has($name))
            ->values();

        if ($missingJobNames->isNotEmpty()) {
            $this->warn('game_jobs に見つからない職業名があります。');
            foreach ($missingJobNames as $name) {
                $this->line("- {$name}");
            }
            $this->warn('game_jobs.name が違う場合は JOB_ABBREVIATIONS を調整してくれ。');
            return self::FAILURE;
        }

        $records = $this->fetchAndParse($url);

        if (empty($records)) {
            $this->error('抽出できた装備がありません。HTML構造を確認してくれ。');
            return self::FAILURE;
        }

        $this->info('抽出件数: ' . count($records));

        $stats = [
            'records' => count($records),
            'matched_equipments' => 0,
            'inherit' => 0,
            'replace' => 0,
            'replace_no_type' => 0,
            'not_found' => 0,
            'unknown_abbr' => 0,
            'duplicate_targets_skipped' => 0,
        ];

        $processedEquipmentIds = [];

        DB::beginTransaction();

        try {
            foreach ($records as $record) {
                $sourceItemName = $record['name'];
                $abbrs = $record['abbrs'];
                $sourceText = $record['source_text'];

                $targetJobIds = $this->resolveJobIds($abbrs, $jobsByName, $allJobIds);

                if ($targetJobIds === null) {
                    $stats['unknown_abbr']++;
                    $this->warn("未対応の職業略称あり: {$sourceText}");
                    continue;
                }

                sort($targetJobIds);

                $equipments = $this->findEquipments($sourceItemName, $match);

                if ($equipments->isEmpty()) {
                    $stats['not_found']++;
                    $this->line("NOT FOUND: {$sourceItemName}");
                    continue;
                }

                $this->newLine();
                $this->info("SOURCE: {$sourceText}");
                $this->line('  keywords: ' . implode(', ', $this->buildArmorNameKeywords($sourceItemName)));
                $this->line('  target jobs: ' . implode(', ', $this->jobNamesFromIds($targetJobIds, $jobsByName)));
                $this->line('  matched equipments: ' . $equipments->count());

                foreach ($equipments as $equipment) {
                    $equipmentId = (int) $equipment->id;

                    if (isset($processedEquipmentIds[$equipmentId])) {
                        $stats['duplicate_targets_skipped']++;
                        continue;
                    }

                    $processedEquipmentIds[$equipmentId] = true;
                    $stats['matched_equipments']++;

                    $hasEquipmentType = !empty($equipment->equipment_type_id);

                    $defaultJobIds = [];

                    if ($hasEquipmentType) {
                        $defaultJobIds = DB::table('equipable_types')
                            ->where('equipment_type_id', $equipment->equipment_type_id)
                            ->pluck('game_job_id')
                            ->map(fn ($id) => (int) $id)
                            ->values()
                            ->all();

                        sort($defaultJobIds);
                    }

                    $sameAsDefault = $hasEquipmentType && $defaultJobIds === $targetJobIds;

                    if ($sameAsDefault) {
                        $stats['inherit']++;

                        $this->line($this->formatEquipmentLogLine('INHERIT', $equipment));

                        if (!$dryRun) {
                            DB::table('equipments')
                                ->where('id', $equipmentId)
                                ->update([
                                    'job_override_mode' => 'inherit',
                                    'updated_at' => now(),
                                ]);

                            DB::table('equipment_job_overrides')
                                ->where('equipment_id', $equipmentId)
                                ->delete();
                        }

                        continue;
                    }

                    $stats['replace']++;

                    if (!$hasEquipmentType) {
                        $stats['replace_no_type']++;
                    }

                    $reason = $hasEquipmentType
                        ? '標準職業と異なるため'
                        : 'equipment_type_id なしのため';

                    $this->line($this->formatEquipmentLogLine('REPLACE', $equipment) . " / {$reason}");

                    if ($hasEquipmentType) {
                        $this->line('  default jobs: ' . implode(', ', $this->jobNamesFromIds($defaultJobIds, $jobsByName)));
                    }

                    if (!$dryRun) {
                        DB::table('equipments')
                            ->where('id', $equipmentId)
                            ->update([
                                'job_override_mode' => 'replace',
                                'updated_at' => now(),
                            ]);

                        DB::table('equipment_job_overrides')
                            ->where('equipment_id', $equipmentId)
                            ->delete();

                        foreach ($targetJobIds as $gameJobId) {
                            DB::table('equipment_job_overrides')->insert([
                                'equipment_id' => $equipmentId,
                                'game_job_id' => $gameJobId,
                                'mode' => 'allow',
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        }
                    }
                }
            }

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $this->newLine();
        $this->info($dryRun ? 'DRY RUN 完了。DBは更新していません。' : '更新完了。');

        $this->table(
            ['key', 'count'],
            collect($stats)->map(fn ($count, $key) => [$key, $count])->values()->all()
        );

        return self::SUCCESS;
    }

    private function fetchAndParse(string $url): array
    {
        $html = Http::timeout(30)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 Laravel Import Command',
            ])
            ->get($url)
            ->throw()
            ->body();

        return $this->parseHtml($html);
    }

    private function parseHtml(string $html): array
    {
        libxml_use_internal_errors(true);

        $dom = new DOMDocument();

        $converted = mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8');
        $dom->loadHTML($converted);

        libxml_clear_errors();

        $xpath = new DOMXPath($dom);

        // li の中の a を対象にする
        // 例:
        // <li>
        //   <a>
        //     <p class="name">
        //       手品師の服
        //       <br>
        //       <span class="text-series">(僧･魔･旅...)</span>
        //     </p>
        //   </a>
        // </li>
        $nodes = $xpath->query('//li/a');

        $records = [];

        foreach ($nodes as $a) {
            $nameNode = $xpath->query('.//*[contains(concat(" ", normalize-space(@class), " "), " name ")]', $a)->item(0);
            $seriesNode = $xpath->query('.//*[contains(concat(" ", normalize-space(@class), " "), " text-series ")]', $a)->item(0);

            if (!$nameNode || !$seriesNode) {
                continue;
            }

            $name = $this->extractNameFromNameNode($nameNode);
            $jobsText = trim($seriesNode->textContent ?? '');

            $jobsText = preg_replace('/^\s*[\(（]/u', '', $jobsText);
            $jobsText = preg_replace('/[\)）]\s*$/u', '', $jobsText);
            $jobsText = trim($jobsText);

            if ($name === '' || $jobsText === '') {
                continue;
            }

            $abbrs = $jobsText === '全職業'
                ? ['全職業']
                : preg_split('/[･・,、\s]+/u', $jobsText, -1, PREG_SPLIT_NO_EMPTY);

            $records[] = [
                'name' => $name,
                'abbrs' => $abbrs,
                'source_text' => "{$name} ({$jobsText})",
            ];
        }

        return collect($records)
            ->filter(fn ($record) => trim((string) $record['name']) !== '')
            ->unique(fn ($record) => $record['source_text'])
            ->values()
            ->all();
    }

    private function extractNameFromNameNode(\DOMNode $nameNode): string
    {
        $text = '';

        foreach ($nameNode->childNodes as $child) {
            if ($child->nodeName === 'br') {
                break;
            }

            if ($child->nodeType === XML_TEXT_NODE) {
                $text .= $child->textContent;
            }
        }

        $text = preg_replace('/\s+/u', ' ', $text);

        return trim($text);
    }

    private function resolveJobIds(array $abbrs, Collection $jobsByName, array $allJobIds): ?array
    {
        if (in_array('全職業', $abbrs, true)) {
            return $allJobIds;
        }

        $jobIds = [];

        foreach ($abbrs as $abbr) {
            $abbr = trim($abbr);

            if ($abbr === '') {
                continue;
            }

            $jobName = self::JOB_ABBREVIATIONS[$abbr] ?? null;

            if (!$jobName) {
                return null;
            }

            $job = $jobsByName->get($jobName);

            if (!$job) {
                return null;
            }

            $jobIds[] = (int) $job->id;
        }

        return collect($jobIds)
            ->unique()
            ->values()
            ->all();
    }

    private function findEquipments(string $itemName, string $match): Collection
    {
        $keywords = $this->buildArmorNameKeywords($itemName);

        if (empty($keywords)) {
            return collect();
        }

        $baseQuery = DB::table('equipments')
            ->select(
                'id',
                'item_name',
                'group_name',
                'group_id',
                'equipment_type_id',
                'job_override_mode'
            );

        $matched = collect();

        foreach ($keywords as $keyword) {
            $rows = (clone $baseQuery)
                ->where(function ($q) use ($keyword, $match) {
                    if ($match === 'item_name') {
                        $q->where('item_name', 'like', "%{$keyword}%");
                        return;
                    }

                    if ($match === 'group_name') {
                        $q->where('group_name', 'like', "%{$keyword}%");
                        return;
                    }

                    $q->where('item_name', 'like', "%{$keyword}%")
                        ->orWhere('group_name', 'like', "%{$keyword}%");
                })
                ->get();

            if ($rows->isNotEmpty()) {
                $matched = $matched->merge($rows);
                break;
            }
        }

        $matched = $matched->unique('id')->values();

        if ($matched->isEmpty()) {
            return $matched;
        }

        $groupIds = $matched
            ->pluck('group_id')
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->unique()
            ->values();

        if ($groupIds->isEmpty()) {
            return $matched;
        }

        // セット防具は、見つかった1部位だけではなく group_id 全体を対象にする
        $groupRows = DB::table('equipments')
            ->select(
                'id',
                'item_name',
                'group_name',
                'group_id',
                'equipment_type_id',
                'job_override_mode'
            )
            ->whereIn('group_id', $groupIds)
            ->get();

        return $matched
            ->merge($groupRows)
            ->unique('id')
            ->values();
    }

    private function buildArmorNameKeywords(string $itemName): array
    {
        $name = trim($itemName);

        if ($name === '') {
            return [];
        }

        $keywords = [];

        // 1. 元の名前
        $keywords[] = $name;

        // 2. 「○○の〜」なら ○○ を優先キーワードにする
        // 例: 手品師の服 => 手品師
        // 例: 退魔の装束 => 退魔
        if (preg_match('/^(.+?)の/u', $name, $m)) {
            $keywords[] = trim($m[1]);
        }

        // 3. よくある部位・セット末尾を削る
        $removeWords = [
            'の服',
            'の装束',
            'のローブ',
            'のころも',
            'のよろい',
            'の鎧',
            'のぼうし',
            'のかぶと',
            'のはちまき',
            'のバンダナ',
            'のフード',
            'のグローブ',
            'のこて',
            'のうでわ',
            'の腕帯',
            'のタイツ',
            'のズボン',
            'のパンツ',
            'の下',
            'のブーツ',
            'のくつ',
            'のサンダル',
            'セット',
        ];

        foreach ($removeWords as $word) {
            if (str_contains($name, $word)) {
                $keywords[] = trim(str_replace($word, '', $name));
            }
        }

        // 4. 「○○セット」も候補にする
        foreach ($keywords as $keyword) {
            $keyword = trim($keyword);

            if ($keyword !== '' && !str_contains($keyword, 'セット')) {
                $keywords[] = "{$keyword}セット";
            }
        }

        return collect($keywords)
            ->map(fn ($value) => trim((string) $value))
            ->filter(fn ($value) => $value !== '')
            ->filter(fn ($value) => mb_strlen($value) >= 2)
            ->unique()
            ->values()
            ->all();
    }

    private function jobNamesFromIds(array $ids, Collection $jobsByName): array
    {
        $jobsById = $jobsByName->values()->keyBy('id');

        return collect($ids)
            ->map(fn ($id) => $jobsById->get($id)?->name ?? "#{$id}")
            ->values()
            ->all();
    }

    private function formatEquipmentLogLine(string $label, object $equipment): string
    {
        $groupName = trim((string) ($equipment->group_name ?? ''));
        $groupId = trim((string) ($equipment->group_id ?? ''));

        $groupText = $groupId
            ? " / group: {$groupName} ({$groupId})"
            : '';

        return "{$label}: #{$equipment->id} {$equipment->item_name}{$groupText}";
    }
}