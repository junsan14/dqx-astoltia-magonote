<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class ImportOrbMonsterDrops extends Command
{
    protected $signature = 'dq10:import-orb-monster-drops
                            {url : 宝珠ページURL}
                            {--delete-existing : 既存の宝珠ドロップを削除してから入れ直す}';

    protected $description = 'Import orb monster drops from DQ10 wiki orb page';

    public function handle(): int
    {
        $url = $this->argument('url');

        $this->info("fetching: {$url}");

        $response = Http::timeout(30)->get($url);

        if (! $response->successful()) {
            $this->error("failed to fetch: {$url}");
            return self::FAILURE;
        }

        $html = $response->body();
        $crawler = new Crawler($html);

        $rows = $crawler->filter('table tr');

        if ($rows->count() === 0) {
            $this->error('no table rows found');
            return self::FAILURE;
        }

        $inserted = 0;
        $skipped = 0;
        $notFoundMonsters = [];

        DB::beginTransaction();

        try {
            foreach ($rows as $rowIndex => $row) {
                $rowCrawler = new Crawler($row);
                $cols = $rowCrawler->filter('td');

                // ヘッダー行や壊れた行は飛ばす
                if ($cols->count() < 5) {
                    $skipped++;
                    continue;
                }

                $orbName = trim($cols->eq(0)->text(''));

                if ($orbName === '' || $orbName === '名称') {
                    $skipped++;
                    continue;
                }

                $orb = DB::table('orbs')->where('name', $orbName)->first();

                if (! $orb) {
                    $this->warn("orb not found: {$orbName}");
                    $skipped++;
                    continue;
                }

                if ($this->option('delete-existing')) {
                    DB::table('monster_drops')
                        ->where('drop_target_type', 'orb')
                        ->where('drop_target_id', $orb->id)
                        ->delete();
                }

                // 5列目がドロップモンスター想定
                $monsterCell = $cols->eq(4);

                $monsterNames = $this->extractMonsterNames($monsterCell);

                if (empty($monsterNames)) {
                    $this->warn("no monsters found for orb: {$orbName}");
                    $skipped++;
                    continue;
                }

                $sortOrder = 1;

                foreach ($monsterNames as $monsterName) {
                    $monster = DB::table('monsters')
                        ->where('name', $monsterName)
                        ->first();

                    if (! $monster) {
                        $notFoundMonsters[] = "{$monsterName} (orb: {$orbName})";
                        $this->warn("monster not found: {$monsterName} (orb: {$orbName})");
                        continue;
                    }

                    $exists = DB::table('monster_drops')
                        ->where('monster_id', $monster->id)
                        ->where('drop_target_type', 'orb')
                        ->where('drop_target_id', $orb->id)
                        ->where('drop_type', 'normal')
                        ->exists();

                    if ($exists) {
                        $this->line("exists: {$monsterName} -> {$orbName}");
                        continue;
                    }

                    DB::table('monster_drops')->insert([
                        'monster_id'       => $monster->id,
                        'drop_target_type' => 'orb',
                        'drop_target_id'   => $orb->id,
                        'drop_type'        => 'normal',
                        'sort_order'       => $sortOrder,
                        'created_at'       => now(),
                        'updated_at'       => now(),
                    ]);

                    $this->info("inserted: {$monsterName} -> {$orbName}");

                    $inserted++;
                    $sortOrder++;
                }
            }

            DB::commit();

            $this->info("done. inserted: {$inserted}, skipped: {$skipped}");

            if (! empty($notFoundMonsters)) {
                $this->newLine();
                $this->warn('=== monsters not found ===');
                foreach (array_unique($notFoundMonsters) as $name) {
                    $this->line($name);
                }
            }

            return self::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }

    /**
     * ドロップモンスター欄からモンスター名一覧を抜き出す
     */
    private function extractMonsterNames(Crawler $monsterCell): array
    {
        $monsterNames = [];

        // まず a タグがあればそれを優先
        try {
            $linkNames = $monsterCell->filter('a')->each(function (Crawler $a) {
                $name = trim($a->text(''));
                return $this->cleanMonsterName($name);
            });

            $linkNames = array_values(array_unique(array_filter($linkNames)));

            if (! empty($linkNames)) {
                return $linkNames;
            }
        } catch (\Throwable $e) {
            // aタグなしでも続行
        }

        // 次に HTML を <br> / 区切り文字で分割
        $html = $monsterCell->html();

        if ($html === null || $html === '') {
            return [];
        }

        $parts = preg_split('/<br\s*\/?>|、|,|\/|→/iu', $html);

        foreach ($parts as $part) {
            $name = strip_tags($part);
            $name = html_entity_decode($name, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $name = $this->cleanMonsterName($name);

            if ($name !== '') {
                $monsterNames[] = $name;
            }
        }

        $monsterNames = array_values(array_unique(array_filter($monsterNames)));

        return $monsterNames;
    }

    /**
     * モンスター名の掃除
     */
    private function cleanMonsterName(string $name): string
    {
        $name = trim($name);

        // 【大魔獣イーギュア】 → 大魔獣イーギュア
        $name = preg_replace('/[【】]/u', '', $name);

        // （転生）みたいな注釈削除
        $name = preg_replace('/（.*?）/u', '', $name);

        // 余分な空白削除
        $name = preg_replace('/\s+/u', '', $name);

        // 表のゴミっぽい値を除外
        $ngWords = [
            'ドロップモンスター',
            'なし',
            '-',
            '―',
            '不明',
        ];

        if (in_array($name, $ngWords, true)) {
            return '';
        }

        return trim($name);
    }
}