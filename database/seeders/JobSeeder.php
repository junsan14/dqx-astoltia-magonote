<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class JobSeeder extends Seeder
{
    public function run(): void
    {
        $jobs = [
            ['key' => 'warrior', 'name' => '戦士'],
            ['key' => 'priest', 'name' => '僧侶'],
            ['key' => 'mage', 'name' => '魔法使い'],
            ['key' => 'martial_artist', 'name' => '武闘家'],
            ['key' => 'thief', 'name' => '盗賊'],
            ['key' => 'minstrel', 'name' => '旅芸人'],
            ['key' => 'battlemaster', 'name' => 'バトルマスター'],
            ['key' => 'paladin', 'name' => 'パラディン'],
            ['key' => 'armamentalist', 'name' => '魔法戦士'],
            ['key' => 'ranger', 'name' => 'レンジャー'],
            ['key' => 'sage', 'name' => '賢者'],
            ['key' => 'superstar', 'name' => 'スーパースター'],
            ['key' => 'monster_master', 'name' => 'まもの使い'],
            ['key' => 'item_master', 'name' => 'どうぐ使い'],
            ['key' => 'dancer', 'name' => '踊り子'],
            ['key' => 'fortune_teller', 'name' => '占い師'],
            ['key' => 'heaven_and_earth', 'name' => '天地雷鳴士'],
            ['key' => 'gadabout', 'name' => '遊び人'],
            ['key' => 'death_master', 'name' => 'デスマスター'],
            ['key' => 'dark_knight', 'name' => '魔剣士'],
            ['key' => 'pirate', 'name' => '海賊'],
            ['key' => 'guardian', 'name' => 'ガーディアン'],
            ['key' => 'dragon_magic', 'name' => '竜術士'],
            ['key' => 'hermit', 'name' => '隠者'],
        ];

        foreach ($jobs as $job) {
            DB::table('game_jobs')->updateOrInsert(
                ['key' => $job['key']],
                [
                    'name' => $job['name'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}