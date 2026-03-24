<?php

namespace App\Console\Commands;

use App\Models\MonsterMapSpawn;
use Illuminate\Console\Command;

class NormalizeMonsterMapSpawnCounts extends Command
{
    protected $signature = 'monster-map-spawns:normalize-counts
                            {--dry-run : DB更新せず確認だけする}
                            {--only-empty : spawn_count / symbol_count が空のものだけ対象にする}';

    protected $description = 'monster_map_spawns.note から spawn_count / symbol_count を抽出して更新する';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $onlyEmpty = (bool) $this->option('only-empty');

        $query = MonsterMapSpawn::query()->orderBy('id');

        if ($onlyEmpty) {
            $query->where(function ($q) {
                $q->whereNull('spawn_count')
                    ->orWhere('spawn_count', '')
                    ->orWhereNull('symbol_count')
                    ->orWhere('symbol_count', '');
            });
        }

        $total = $query->count();
        $updated = 0;
        $skipped = 0;

        $this->info("対象件数: {$total}");

        $query->chunkById(200, function ($rows) use ($dryRun, &$updated, &$skipped) {
            foreach ($rows as $row) {
                $note = $this->normalizeNoteText($row->note);

                if ($note === '') {
                    $skipped++;
                    $this->line("[SKIP] id={$row->id} note空");
                    continue;
                }

                $detectedSpawnCount = $this->extractSpawnCount($note);
                $detectedSymbolCount = $this->extractSymbolCount($note);

                $newSpawnCount = $detectedSpawnCount ?: $row->spawn_count;
                $newSymbolCount = $detectedSymbolCount ?: $row->symbol_count;

                $changed = false;

                if ($detectedSpawnCount && $row->spawn_count !== $detectedSpawnCount) {
                    $changed = true;
                }

                if ($detectedSymbolCount && $row->symbol_count !== $detectedSymbolCount) {
                    $changed = true;
                }

                $this->line(sprintf(
                    '[CHECK] id=%d | spawn: "%s" -> "%s" | symbol: "%s" -> "%s" | note=%s',
                    $row->id,
                    $row->spawn_count ?? '',
                    $detectedSpawnCount ?? ($row->spawn_count ?? ''),
                    $row->symbol_count ?? '',
                    $detectedSymbolCount ?? ($row->symbol_count ?? ''),
                    mb_substr(preg_replace("/\s+/u", ' ', $note), 0, 120)
                ));

                if (! $changed) {
                    $skipped++;
                    continue;
                }

                if (! $dryRun) {
                    $row->update([
                        'spawn_count' => $newSpawnCount,
                        'symbol_count' => $newSymbolCount,
                    ]);
                }

                $updated++;
            }
        });

        $this->newLine();
        $this->info("更新件数: {$updated}");
        $this->info("スキップ件数: {$skipped}");
        $this->info($dryRun ? 'dry-run のためDB更新なし' : '更新完了');

        return self::SUCCESS;
    }

    private function normalizeNoteText(?string $note): string
    {
        if (! is_string($note) || trim($note) === '') {
            return '';
        }

        $text = trim($note);

        // JSON文字列っぽいものを数回デコードして平文化
        for ($i = 0; $i < 3; $i++) {
            $decoded = json_decode($text, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                break;
            }

            if (is_array($decoded)) {
                $text = $this->flattenToText($decoded);
                continue;
            }

            if (is_string($decoded)) {
                $text = $decoded;
                continue;
            }

            break;
        }

        // いかにも JSON配列断片みたいなものをざっくり整形
        $text = str_replace(
            ['\\"', '\\/', "\r"],
            ['"', '/', "\n"],
            $text
        );

        $text = preg_replace('/[\[\]{}"]/u', ' ', $text);
        $text = preg_replace('/\s+/u', ' ', $text);

        return trim($text);
    }

    private function flattenToText(mixed $value): string
    {
        if (is_string($value)) {
            return $value;
        }

        if (is_array($value)) {
            $parts = [];

            array_walk_recursive($value, function ($item) use (&$parts) {
                if (is_scalar($item)) {
                    $parts[] = (string) $item;
                }
            });

            return implode(' / ', $parts);
        }

        return '';
    }

    private function extractSpawnCount(string $text): ?string
    {
        $normalized = $this->toAsciiNumbers($text);

        // まず 範囲表現を優先
        $rangePatterns = [
            '/(\d+)\s*[~〜～\-－ー]\s*(\d+)\s*匹/u',
            '/(\d+)\s*[~〜～\-－ー]\s*(\d+)\s*体/u',
            '/(\d+)\s*[~〜～\-－ー]\s*(\d+)\s*頭/u',
            '/(\d+)\s*[~〜～\-－ー]\s*(\d+)\s*羽/u',
            '/(\d+)\s*[~〜～\-－ー]\s*(\d+)\s*ずつ/u',
        ];

        foreach ($rangePatterns as $pattern) {
            if (preg_match($pattern, $normalized, $m)) {
                return $m[1] . '〜' . $m[2];
            }
        }

        // 単数
        $singlePatterns = [
            '/(?<!\d)(\d+)\s*匹/u',
            '/(?<!\d)(\d+)\s*体/u',
            '/(?<!\d)(\d+)\s*頭/u',
            '/(?<!\d)(\d+)\s*羽/u',
            '/(?<!\d)(\d+)\s*ずつ/u',
        ];

        foreach ($singlePatterns as $pattern) {
            if (preg_match($pattern, $normalized, $m)) {
                return $m[1];
            }
        }

        // 単位なしの範囲も一応拾う
        if (preg_match('/(?<![A-Z])(?<![A-Z]-)(\d+)\s*[~〜～\-－ー]\s*(\d+)(?!-\d)/u', $normalized, $m)) {
            return $m[1] . '〜' . $m[2];
        }

        return null;
    }

private function extractSymbolCount(string $text): ?string
{
    $normalized = $this->toAsciiNumbers($text);

    // =========================
    // 0. 最優先
    // =========================

    // 転生
    if (mb_stripos($normalized, '転生') !== false) {
        return '転生';
    }

    // 全域にいる = 多い
    if (mb_stripos($normalized, '全域') !== false) {
        return '多い';
    }

    // 座標つきの匹数から symbol_count を推定
    $coordinateBased = $this->extractCoordinateBasedSymbolCount($normalized);
    if ($coordinateBased !== null) {
        return $coordinateBased;
    }

    // =========================
    // 1. 多い系
    // =========================
    $manyWords = [
        'たくさん','多数','大量','大量にいる','大量に出る','多い','多め',
        'いっぱい','いっぱいいる',
        'うじゃうじゃ','わんさか','わらわら','うようよ','ぞろぞろ',
        'びっしり','ぎっしり','密集','密集している','密集してます',
        '群生','群れている','固まっている','固まって出る',
        '豊富','大量発生','頻繁に出る','頻繁にいる',
        'よくいる','よく出る','よく見かける',
        'すぐ見つかる','すぐいる','簡単に見つかる',
        '常にいる','あちこちにいる','どこにでもいる','そこら中にいる',
        '多く見かける','多く見られる','多そう',
        'かなり多い','非常に多い','すごく多い','すごい多い',
        'めっちゃ多い','めちゃ多い','とても多い','けっこう多い','割と多い',
        'かなりいる','すごくいる','すごいいる','めっちゃいる','めちゃいる',
    ];

    // =========================
    // 2. 少ない系
    // =========================
    $fewWords = [
        '少ない','少なめ','少数','わずか','希少','レア','レア気味',
        'まばら','点在','点在している','ぽつぽつ','ちらほら',
        'ぽつりぽつり','散在','飛び飛び','散らばっている',
        'あまりいない','あまり居ない','見かけない','あまり見かけない',
        'なかなかいない','なかなか見つからない',
        'ほとんどいない','ほぼいない',
        '滅多にいない','めったにいない',
        'あまり出ない','なかなか出ない','ほぼ出ない','出にくい',
        '微妙','しょぼい','厳しい','探さないといない',
        '少なそう',
        'かなり少ない','非常に少ない','すごく少ない','すごい少ない',
        'めっちゃ少ない','めちゃ少ない','とても少ない',
    ];

    // =========================
    // 3. 普通系
    // =========================
    $normalWords = [
        '普通','そこそこ','それなり','ほどほど','中くらい',
        '平均的','まあまあ','ある程度いる','普通にいる',
        'そこそこいる','適度にいる','普通に見かける',
        'そこそこ見かける','それなりにいる','それなりに見かける',
    ];

    foreach ($manyWords as $w) {
        if (mb_stripos($normalized, $w) !== false) {
            return '多い';
        }
    }

    foreach ($fewWords as $w) {
        if (mb_stripos($normalized, $w) !== false) {
            return '少ない';
        }
    }

    foreach ($normalWords as $w) {
        if (mb_stripos($normalized, $w) !== false) {
            return '普通';
        }
    }

    // =========================
    // 4. 修飾語パターン
    // =========================

    if (preg_match('/(すごく|すごい|めっちゃ|めちゃ|かなり|とても|非常に|けっこう|割と)\s*(多い|いる|たくさん|いっぱい)/u', $normalized)) {
        return '多い';
    }

    if (preg_match('/(すごく|すごい|めっちゃ|めちゃ|かなり|とても|非常に)\s*(少ない|いない)/u', $normalized)) {
        return '少ない';
    }

    if (preg_match('/(あまり|ほとんど|なかなか|滅多に|めったに)\s*(いない|出ない|見ない|見かけない)/u', $normalized)) {
        return '少ない';
    }

    if (preg_match('/(よく|頻繁に)\s*(出る|いる|見かける)/u', $normalized)) {
        return '多い';
    }

    // =========================
    // 5. 文脈パターン
    // =========================

    if (preg_match('/(数|シンボル|シンボル数|配置|出現)\s*(が|は)?\s*(多い|多め|豊富)/u', $normalized)) {
        return '多い';
    }

    if (preg_match('/(数|シンボル|シンボル数|配置|出現)\s*(が|は)?\s*(少ない|少なめ)/u', $normalized)) {
        return '少ない';
    }

    if (preg_match('/(数|シンボル|配置)\s*(が|は)?\s*(普通|そこそこ|それなり)/u', $normalized)) {
        return '普通';
    }

    if (preg_match('/(数|シンボル|配置)\s*(が|は)?\s*まばら/u', $normalized)) {
        return '少ない';
    }

    // =========================
    // 6. 何にも引っかからなければ普通
    // =========================
    return '普通';
}

private function extractCoordinateBasedSymbolCount(string $text): ?string
{
    $patterns = [
        // B4に2匹います
        '/[A-Z]\-?\d+\s*(に|で|付近に|あたりに|周辺に)?\s*(\d+)\s*匹/u',

        // B4に1〜3匹います
        '/[A-Z]\-?\d+\s*(に|で|付近に|あたりに|周辺に)?\s*(\d+)\s*[~〜～\-－ー]\s*(\d+)\s*匹/u',

        // 南の海岸 B4 2匹
        '/[A-Z]\-?\d+.*?(\d+)\s*匹/u',

        // B4付近に4以上
        '/[A-Z]\-?\d+\s*(に|で|付近に|あたりに|周辺に)?\s*(\d+)\s*以上/u',
    ];

    // 範囲: 1〜3匹, 3〜5匹 など
    if (preg_match('/[A-Z]\-?\d+\s*(に|で|付近に|あたりに|周辺に)?\s*(\d+)\s*[~〜～\-－ー]\s*(\d+)\s*匹/u', $text, $m)) {
        return $this->normalizeSymbolLevelFromNumbers((int) $m[2], (int) $m[3]);
    }

    // 4以上
    if (preg_match('/[A-Z]\-?\d+\s*(に|で|付近に|あたりに|周辺に)?\s*(\d+)\s*以上/u', $text, $m)) {
        return $this->normalizeSymbolLevelFromNumbers((int) $m[2], null, true);
    }

    // 単数
    if (preg_match('/[A-Z]\-?\d+\s*(に|で|付近に|あたりに|周辺に)?\s*(\d+)\s*匹/u', $text, $m)) {
        return $this->normalizeSymbolLevelFromNumbers((int) $m[2]);
    }

    return null;
}
private function normalizeSymbolLevelFromNumbers(int $min, ?int $max = null, bool $isOrMore = false): string
{
    // 4以上
    if ($isOrMore) {
        return $min >= 4 ? '多い' : '普通';
    }

    // 単数
    if ($max === null) {
        if ($min <= 2) {
            return '少ない';
        }

        if ($min === 3) {
            return '普通';
        }

        return '多い';
    }

    // 範囲
    // 1〜3 => 少ない
    if ($min <= 1 && $max <= 3) {
        return '少ない';
    }

    // 3〜5 => 普通
    if ($min <= 3 && $max <= 5) {
        return '普通';
    }

    // 4以上を含む範囲は多い寄り
    if ($max >= 4) {
        return '多い';
    }

    return '普通';
}

    private function normalizeSymbolWord(string $word): string
{
    $map = [
        'たくさん' => 'たくさん',
        '多数' => '多数',
        '大量' => '多数',
        '多め' => '多め',
        '多い' => '多い',
        'いっぱい' => 'たくさん',
        'うじゃうじゃ' => 'たくさん',
        'わんさか' => 'たくさん',
        'わらわら' => 'たくさん',
        'うようよ' => 'たくさん',
        'びっしり' => '多い',
        'ぎっしり' => '多い',
        '密集' => '多い',
        '群生' => '多い',
        '豊富' => '多い',

        '少なめ' => '少なめ',
        '少ない' => '少ない',
        'まばら' => 'まばら',
        '点在' => 'まばら',
        'ぽつぽつ' => 'まばら',
        'ちらほら' => '少なめ',
        'レア' => '少ない',
        '希少' => '少ない',
        '微妙' => '少ない',
        'わずか' => '少ない',
        '少数' => '少ない',

        '普通' => '普通',
        'そこそこ' => 'そこそこ',
        'それなり' => 'そこそこ',
        'ほどほど' => 'そこそこ',
        'まあまあ' => 'そこそこ',
        '平均的' => '普通',
    ];

    return $map[$word] ?? $word;
}

    private function toAsciiNumbers(string $text): string
    {
        return mb_convert_kana($text, 'asKV', 'UTF-8');
    }
}