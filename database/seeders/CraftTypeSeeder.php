<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CraftTypeSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['key' => 'weapon',  'name' => '武器鍛冶'],
            ['key' => 'armor',   'name' => '防具鍛冶'],
            ['key' => 'wood',    'name' => '木工'],
            ['key' => 'tailor',  'name' => '裁縫'],
            ['key' => 'lamp',    'name' => 'ランプ'],
            ['key' => 'pot',     'name' => 'つぼ'],
        ];

        foreach ($rows as $row) {
            DB::table('craft_types')->updateOrInsert(
                ['key' => $row['key']],
                ['name' => $row['name']]
            );
        }
    }
}