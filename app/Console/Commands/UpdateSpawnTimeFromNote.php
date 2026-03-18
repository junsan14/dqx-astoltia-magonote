<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class UpdateSpawnTimeFromNote extends Command
{
    // --dry-run オプション追加
    protected $signature = 'spawn:update-time {--dry-run}';
    protected $description = 'Update spawn_time from note field (only normal records)';

    public function handle()
    {
        $isDryRun = $this->option('dry-run');

        $this->info('処理開始' . ($isDryRun ? ' [DRY RUN]' : ''));

        $targets = DB::table('monster_map_spawns')
            ->where('spawn_time', 'normal') // ★ここがポイント
            ->where(function ($q) {
                $q->where('note', 'like', '%夜%')
                  ->orWhere('note', 'like', '%よる%')
                  ->orWhere('note', 'like', '%昼%')
                  ->orWhere('note', 'like', '%日中%');
            })
            ->get();

        $this->info("対象件数: " . $targets->count());

        foreach ($targets as $row) {
            $spawnTime = null;

            if (str_contains($row->note, '夜') || str_contains($row->note, 'よる')) {
                $spawnTime = '夜';
            } elseif (str_contains($row->note, '昼') || str_contains($row->note, '日中')) {
                $spawnTime = '昼';
            }

            if (!$spawnTime) {
                continue;
            }

            if ($isDryRun) {
                $this->line("[DRY] ID {$row->id} → {$spawnTime}");
            } else {
                DB::table('monster_map_spawns')
                    ->where('id', $row->id)
                    ->update([
                        'spawn_time' => $spawnTime,
                        'updated_at' => now(),
                    ]);

                $this->line("更新: ID {$row->id} → {$spawnTime}");
            }
        }

        $this->info('完了');
    }
}