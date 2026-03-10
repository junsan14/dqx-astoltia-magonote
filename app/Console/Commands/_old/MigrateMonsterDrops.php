<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MigrateMonsterDrops extends Command
{
    protected $signature = 'dq10:migrate-drops';
    protected $description = 'Move monster drops to monster_drops table';

    public function handle()
    {
        $monsters = DB::table('monsters')->get();

        foreach ($monsters as $monster) {

            // 通常ドロップ
            if ($monster->normal_drop) {

                $item = DB::table('items')
                    ->where('name', $monster->normal_drop)
                    ->first();

                if ($item) {

                    DB::table('monster_drops')->insert([
                        'monster_id' => $monster->id,
                        'drop_target_type' => 'item',
                        'drop_target_id' => $item->id,
                        'drop_type' => 'normal',
                        'sort_order' => 1,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            // レアドロップ
            if ($monster->rare_drop) {

                $item = DB::table('items')
                    ->where('name', $monster->rare_drop)
                    ->first();

                if ($item) {

                    DB::table('monster_drops')->insert([
                        'monster_id' => $monster->id,
                        'drop_target_type' => 'item',
                        'drop_target_id' => $item->id,
                        'drop_type' => 'rare',
                        'sort_order' => 2,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }

        $this->info("Drops migrated!");
    }
}