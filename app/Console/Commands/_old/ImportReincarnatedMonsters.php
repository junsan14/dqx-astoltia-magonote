<?php

namespace App\Console\Commands;

use App\Models\Monster;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class ImportReincarnatedMonsters extends Command
{
    protected $signature = 'monsters:import-reincarnations
        {--url=https://dragon-quest.jp/ten/monster/tensei.php : 取得元URL}
        {--dry-run : DB更新せず確認だけ}
        {--create-missing : 子モンスターが未登録なら新規作成}
        {--force-parent-null : 親が未登録でも子だけ更新/作成する}';

    protected $description = '転生モンスターページの「名前」「転生前」だけ取得して monsters テーブルへ反映する';

    public function handle(): int
    {
        $url = (string) $this->option('url');
        $dryRun = (bool) $this->option('dry-run');
        $createMissing = (bool) $this->option('create-missing');
        $forceParentNull = (bool) $this->option('force-parent-null');

        $this->info("Fetch: {$url}");

        if ($dryRun) {
            $this->warn('DRY RUN mode');
        }

        try {
            $html = Http::timeout(30)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (compatible; ImportReincarnatedMonsters/1.0)',
                    'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
                ])
                ->get($url)
                ->throw()
                ->body();
        } catch (\Throwable $e) {
            $this->error('ページ取得失敗: ' . $e->getMessage());
            return self::FAILURE;
        }

        $pairs = $this->extractPairs($html);

        if (empty($pairs)) {
            $this->warn('親子ペアを取得できなかった');
            return self::SUCCESS;
        }

        $this->info('抽出件数: ' . count($pairs));

        $updated = 0;
        $created = 0;
        $skipped = 0;

        DB::beginTransaction();

        try {
            foreach ($pairs as $pair) {
                $childName = $pair['child_name'];
                $parentName = $pair['parent_name'];

                $parent = Monster::query()
                    ->where('name', $parentName)
                    ->orderBy('id')
                    ->first();

                if (! $parent && ! $forceParentNull) {
                    $this->warn("[SKIP] 親が未登録: {$childName} ← {$parentName}");
                    $skipped++;
                    continue;
                }

                $child = Monster::query()
                    ->where('name', $childName)
                    ->orderBy('id')
                    ->first();

                $payload = [
                    'name' => $childName,
                    'is_reincarnated' => 1,
                    'reincarnation_parent_id' => $parent?->id,
                    'source_url' => $url,
                    'updated_at' => now(),
                ];

                if ($child) {
                    if ($dryRun) {
                        $this->line(sprintf(
                            '[UPDATE] %s ← %s | child_id=%s parent_id=%s',
                            $childName,
                            $parentName,
                            $child->id,
                            $parent?->id ?? 'null'
                        ));
                    } else {
                        $child->fill($payload)->save();
                    }

                    $updated++;
                    continue;
                }

                if (! $createMissing) {
                    $this->warn("[SKIP] 子が未登録: {$childName} ← {$parentName}");
                    $skipped++;
                    continue;
                }

                $displayOrder = $this->nextDisplayOrder();
                $systemType = $parent?->system_type;

                if ($dryRun) {
                    $this->line(sprintf(
                        '[CREATE] %s ← %s | display_order=%s parent_id=%s',
                        $childName,
                        $parentName,
                        $displayOrder,
                        $parent?->id ?? 'null'
                    ));
                } else {
                    Monster::query()->create([
                        'display_order' => $displayOrder,
                        'name' => $childName,
                        'system_type' => $systemType,
                        'is_reincarnated' => 1,
                        'reincarnation_parent_id' => $parent?->id,
                        'source_url' => $url,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                $created++;
            }

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('取込中にエラー: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->newLine();
        $this->info("updated: {$updated}");
        $this->info("created: {$created}");
        $this->info("skipped: {$skipped}");

        return self::SUCCESS;
    }

    /**
     * #aatable の tr を見て
     * td[0] = 名前
     * td[5] = 転生前
     * だけを抜く
     */
    protected function extractPairs(string $html): array
    {
        $crawler = new Crawler($html);
        $pairs = [];

        $rows = $crawler->filter('#aatable tr.weprow');

        foreach ($rows as $row) {
            $rowCrawler = new Crawler($row);
            $tds = $rowCrawler->filter('td');

            // 必要列:
            // 0 名前
            // 5 転生前
            if ($tds->count() < 6) {
                continue;
            }

            $childName = $this->extractCellText($tds->eq(0));
            $parentName = $this->extractCellText($tds->eq(5));

            if (! $this->isValidMonsterPair($childName, $parentName)) {
                continue;
            }

            $pairs[] = [
                'child_name' => $childName,
                'parent_name' => $parentName,
            ];
        }

        $results = [];
        $seen = [];

        foreach ($pairs as $pair) {
            $key = $pair['child_name'] . '||' . $pair['parent_name'];

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $results[] = $pair;
        }

        return $results;
    }

    protected function extractCellText(Crawler $cell): string
    {
        $text = $cell->text('');
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/u', ' ', trim($text));
        $text = preg_replace('/^[\s　]+|[\s　]+$/u', '', $text);

        return trim($text);
    }

    protected function isValidMonsterPair(string $child, string $parent): bool
    {
        if ($child === '' || $parent === '') {
            return false;
        }

        if ($child === $parent) {
            return false;
        }

        if (mb_strlen($child) > 50 || mb_strlen($parent) > 50) {
            return false;
        }

        $ngWords = [
            '名前',
            '転生前',
            '出現エリア',
            '通常ドロップ',
            'レアドロップ',
            '称号',
            'EXP',
        ];

        foreach ([$child, $parent] as $value) {
            foreach ($ngWords as $ng) {
                if (mb_strpos($value, $ng) !== false) {
                    return false;
                }
            }
        }

        return true;
    }

    protected function nextDisplayOrder(): int
    {
        return ((int) Monster::query()->max('display_order')) + 1;
    }
}