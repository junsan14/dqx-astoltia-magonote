<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EquipmentTypeSeeder extends Seeder
{
    public function run(): void
    {
        $craftTypes = DB::table('craft_types')->pluck('id', 'name');

        $rows = [

            // 武器
            ['key' => 'sword_1h', 'name' => '片手剣', 'kind' => 'weapon', 'craft' => '武器鍛冶'],
            ['key' => 'sword_2h', 'name' => '両手剣', 'kind' => 'weapon', 'craft' => '武器鍛冶'],
            ['key' => 'dagger', 'name' => '短剣', 'kind' => 'weapon', 'craft' => '武器鍛冶'],
            ['key' => 'spear', 'name' => 'ヤリ', 'kind' => 'weapon', 'craft' => '武器鍛冶'],
            ['key' => 'axe', 'name' => 'オノ', 'kind' => 'weapon', 'craft' => '武器鍛冶'],
            ['key' => 'hammer', 'name' => 'ハンマー', 'kind' => 'weapon', 'craft' => '武器鍛冶'],
            ['key' => 'claw', 'name' => 'ツメ', 'kind' => 'weapon', 'craft' => '武器鍛冶'],
            ['key' => 'whip', 'name' => 'ムチ', 'kind' => 'weapon', 'craft' => '武器鍛冶'],
            ['key' => 'boomerang', 'name' => 'ブーメラン', 'kind' => 'weapon', 'craft' => '木工'],
            ['key' => 'stick', 'name' => 'スティック', 'kind' => 'weapon', 'craft' => '木工'],
            ['key' => 'staff_2h', 'name' => '両手杖', 'kind' => 'weapon', 'craft' => '木工'],
            ['key' => 'kon', 'name' => '棍', 'kind' => 'weapon', 'craft' => '木工'],
            ['key' => 'fan', 'name' => '扇', 'kind' => 'weapon', 'craft' => '木工'],
            ['key' => 'bow', 'name' => '弓', 'kind' => 'weapon', 'craft' => '木工'],
            ['key' => 'scythe', 'name' => '鎌', 'kind' => 'weapon', 'craft' => '武器鍛冶'],

            // 防具
            ['key' => 'shield_small', 'name' => '小盾', 'kind' => 'armor', 'craft' => '防具鍛冶'],
            ['key' => 'shield_large', 'name' => '大盾', 'kind' => 'armor', 'craft' => '防具鍛冶'],
            ['key' => 'armor', 'name' => '鎧', 'kind' => 'armor', 'craft' => '防具鍛冶'],
            ['key' => 'robe', 'name' => 'ローブ', 'kind' => 'armor', 'craft' => '裁縫'],
            ['key' => 'butoka_type', 'name' => '武闘家装備', 'kind' => 'armor', 'craft' => '裁縫'],
            ['key' => 'tozoku_type', 'name' => '盗賊装備', 'kind' => 'armor', 'craft' => '裁縫'],
            ['key' => 'tabi_type', 'name' => '旅芸人装備', 'kind' => 'armor', 'craft' => '裁縫'],
        ];

        foreach ($rows as $row) {

            DB::table('equipment_types')->updateOrInsert(
                ['key' => $row['key']],
                [
                    'name' => $row['name'],
                    'kind' => $row['kind'],
                    'craft_type_id' => $craftTypes[$row['craft']] ?? null,
                ]
            );
        }
    }
}