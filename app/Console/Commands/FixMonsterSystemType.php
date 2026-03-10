<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixMonsterSystemType extends Command
{
    protected $signature = 'dq10:fix-monster-system-type';
    protected $description = 'Fill missing system_type using base monster name';

    public function handle()
    {
        $monsters = DB::table('monsters')
            ->whereNull('system_type')
            ->get();

        $count = 0;

        foreach ($monsters as $monster) {

            // 「・」より前を取得
            $baseName = explode('・', $monster->name)[0];

            $baseMonster = DB::table('monsters')
                ->where('name', $baseName)
                ->whereNotNull('system_type')
                ->first();

            if ($baseMonster) {

                DB::table('monsters')
                    ->where('id', $monster->id)
                    ->update([
                        'system_type' => $baseMonster->system_type
                    ]);

                $this->info("updated: {$monster->name} -> {$baseMonster->system_type}");
                $count++;
            }
        }

        $this->info("done. updated {$count} monsters.");
    }
}