<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class NormalizeAccessoryEffects extends Command
{
    protected $signature = 'accessories:normalize-effects 
                            {--dry-run : DBを更新せず、結果だけ確認する}
                            {--limit= : 処理件数を制限する}';

    protected $description = 'Move status effects from accessories.effects_json into dedicated columns and remove them from effects_json';

    private array $statusMap = [
        'こうげき力' => 'attack',
        'しゅび力' => 'defense',
        'さいだいHP' => 'max_hp',
        'さいだいMP' => 'max_mp',
        'おしゃれさ' => 'charm',
        'すばやさ' => 'agility',
        'きようさ' => 'dexterity',
        'こうげき魔力' => 'magic_attack',
        'かいふく魔力' => 'healing_power',
        'おもさ' => 'weight',
    ];

    public function handle(): int
    {
        $isDryRun = (bool) $this->option('dry-run');
        $limit = $this->option('limit');

        $query = DB::table('accessories')
            ->whereNotNull('effects_json')
            ->orderBy('id');

        if ($limit) {
            $query->limit((int) $limit);
        }

        $items = $query->get();

        if ($items->isEmpty()) {
            $this->info('対象データがありません。');
            return self::SUCCESS;
        }

        $updatedCount = 0;

        foreach ($items as $item) {
            $effects = $this->decodeEffectsJson($item->effects_json);

            if (! is_array($effects)) {
                $this->warn("ID {$item->id}: effects_json を配列として読めませんでした。スキップします。");
                continue;
            }

            $extracted = [];
            $remainingEffects = [];

            foreach ($effects as $effect) {
                if (! is_string($effect)) {
                    $remainingEffects[] = $effect;
                    continue;
                }

                $result = $this->extractStatusEffect($effect);

                if ($result === null) {
                    $remainingEffects[] = $effect;
                    continue;
                }

                [$column, $value] = $result;

                // 同じステータスが複数あった場合は合算する
                $extracted[$column] = ($extracted[$column] ?? 0) + $value;
            }

            if (empty($extracted)) {
                continue;
            }

            $updateData = [];

            foreach ($extracted as $column => $value) {
                $updateData[$column] = $value;
            }

            $updateData['effects_json'] = json_encode(
                array_values($remainingEffects),
                JSON_UNESCAPED_UNICODE
            );

            $updateData['updated_at'] = now();

            $updatedCount++;

            $this->line('');
            $this->info("ID {$item->id}: {$item->name}");

            foreach ($extracted as $column => $value) {
                $this->line("  {$column}: {$value}");
            }

            $this->line('  remaining effects_json: ' . $updateData['effects_json']);

            if (! $isDryRun) {
                DB::table('accessories')
                    ->where('id', $item->id)
                    ->update($updateData);
            }
        }

        $this->line('');

        if ($isDryRun) {
            $this->warn("DRY RUN: {$updatedCount}件が更新対象です。DBは変更していません。");
        } else {
            $this->info("完了: {$updatedCount}件を更新しました。");
        }

        return self::SUCCESS;
    }

    private function decodeEffectsJson(mixed $value): ?array
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value)) {
            return null;
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : null;
    }

    private function extractStatusEffect(string $effect): ?array
    {
        $normalized = $this->normalizeText($effect);

        foreach ($this->statusMap as $label => $column) {
            $pattern = '/^' . preg_quote($label, '/') . '\s*\+\s*(\d+)$/u';

            if (preg_match($pattern, $normalized, $matches)) {
                return [$column, (int) $matches[1]];
            }
        }

        return null;
    }

    private function normalizeText(string $text): string
    {
        return str_replace(
            ['＋', '％', '　'],
            ['+', '%', ' '],
            trim($text)
        );
    }
}