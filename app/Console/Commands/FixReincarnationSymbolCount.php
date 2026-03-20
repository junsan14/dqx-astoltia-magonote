<?php

namespace App\Console\Commands;

use App\Models\MonsterMapSpawn;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixReincarnationSymbolCount extends Command
{
    protected $signature = 'monsters:fix-reincarnation-symbol-count {--dry-run : 更新せず確認だけする}';
    protected $description = '転生元モンスターに誤って入っている symbol_count=転生 を修正する';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        $targets = MonsterMapSpawn::query()
            ->select([
                'monster_map_spawns.id',
                'monster_map_spawns.monster_id',
                'monster_map_spawns.map_id',
                'monster_map_spawns.map_layer_id',
                'monster_map_spawns.area',
                'monster_map_spawns.symbol_count',
                'monsters.name as monster_name',
                'monsters.is_reincarnated',
                'monsters.reincarnation_parent_id',
            ])
            ->join('monsters', 'monsters.id', '=', 'monster_map_spawns.monster_id')
            ->where('monster_map_spawns.symbol_count', '転生')
            ->where(function ($query) {
                $query->where('monsters.is_reincarnated', 0)
                    ->orWhereNull('monsters.is_reincarnated');
            })
            ->orderBy('monster_map_spawns.id')
            ->get();

        if ($targets->isEmpty()) {
            $this->info('修正対象なし');
            return self::SUCCESS;
        }

        $this->info("対象件数: {$targets->count()}");

        foreach ($targets as $row) {
            $this->line(sprintf(
                '[TARGET] spawn_id=%d monster_id=%d monster=%s map_id=%s layer_id=%s area=%s symbol_count=%s',
                $row->id,
                $row->monster_id,
                $row->monster_name,
                $row->map_id ?? 'null',
                $row->map_layer_id ?? 'null',
                $row->area ?? '',
                $row->symbol_count ?? 'null'
            ));
        }

        if ($dryRun) {
            $this->comment('dry-run のため更新していない');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($targets) {
            foreach ($targets as $row) {
                MonsterMapSpawn::query()
                    ->where('id', $row->id)
                    ->update([
                        'symbol_count' => null,
                        'updated_at' => now(),
                    ]);
            }
        });

        $this->info('修正完了: symbol_count を null に更新した');
        return self::SUCCESS;
    }
}