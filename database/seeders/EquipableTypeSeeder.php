<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EquipableTypeSeeder extends Seeder
{
    public function run(): void
    {
        $jobIds = DB::table('game_jobs')->pluck('id', 'name');
        $equipmentTypeIds = DB::table('equipment_types')->pluck('id', 'name');

        $map = [
            '片手剣' => ['戦士', 'バトルマスター', '魔法戦士', '占い師', '遊び人', 'パラディン', '魔剣士', 'ガーディアン'],
            '両手剣' => ['戦士', 'バトルマスター', 'まもの使い', '魔剣士', 'ガーディアン'],
            '短剣' => ['魔法使い', '盗賊', '旅芸人', '踊り子', '遊び人', '魔剣士', '海賊'],
            'ヤリ' => ['僧侶', 'パラディン', 'どうぐ使い', '武闘家', 'ガーディアン'],
            'オノ' => ['戦士', 'レンジャー', 'まもの使い', 'デスマスター', '海賊'],
            'ハンマー' => ['バトルマスター', 'パラディン', 'どうぐ使い', '遊び人'],
            'ツメ' => ['武闘家', '盗賊', 'まもの使い', 'レンジャー'],
            'ムチ' => ['魔法使い', '盗賊', 'スーパースター', 'まもの使い', '占い師'],
            'ブーメラン' => ['レンジャー', '賢者', 'どうぐ使い', '遊び人', '旅芸人', '海賊', '隠者'],
            'スティック' => ['僧侶', 'パラディン', 'スーパースター', '踊り子', '天地雷鳴士', '竜術士', '隠者'],
            '両手杖' => ['魔法使い', '魔法戦士', '賢者', '天地雷鳴士', '竜術士'],
            '棍' => ['僧侶', '武闘家', '旅芸人', '占い師', 'デスマスター'],
            '扇' => ['武闘家', '旅芸人', 'スーパースター', '踊り子', '天地雷鳴士', '賢者', '隠者'],
            '弓' => ['魔法戦士', 'レンジャー', '賢者', 'どうぐ使い', '占い師', 'デスマスター', '海賊', '竜術士', '隠者'],
            '鎌' => ['デスマスター', 'スーパースター', '魔剣士', '竜術士'],
            '大盾' => ['戦士', 'パラディン', '魔法戦士', '魔剣士', 'ガーディアン'],
            '小盾' => ['戦士', '僧侶', '魔法使い', '盗賊', '旅芸人', 'パラディン', '魔法戦士', 'レンジャー', '賢者', 'スーパースター', 'どうぐ使い', '占い師', '天地雷鳴士', '遊び人', '魔剣士', '海賊', 'ガーディアン', '竜術士', '隠者'],

            '鎧' => ['戦士', 'パラディン', '魔法戦士', '魔剣士', 'ガーディアン'],
            'ローブ' => ['僧侶', '魔法使い', '賢者', '占い師', '天地雷鳴士', 'デスマスター', '竜術士', '隠者'],
            '武闘家装備' => ['武闘家', 'バトルマスター', 'まもの使い', '踊り子'],
            '盗賊装備' => ['盗賊', '魔法戦士', 'どうぐ使い', '海賊'],
            '旅芸人装備' => ['旅芸人', 'レンジャー', 'スーパースター', '踊り子', '遊び人'],
            
        ];

        foreach ($map as $equipmentTypeName => $jobs) {
            $equipmentTypeId = $equipmentTypeIds[$equipmentTypeName] ?? null;

            if (!$equipmentTypeId) {
                $this->command?->warn("equipment_types に存在しない: {$equipmentTypeName}");
                continue;
            }

            foreach ($jobs as $jobName) {
                $normalizedJobName = $this->normalizeJobName($jobName);
                $jobId = $jobIds[$normalizedJobName] ?? null;

                if (!$jobId) {
                    $this->command?->warn("game_jobs に存在しない: {$jobName} -> {$normalizedJobName}");
                    continue;
                }

                DB::table('equipable_types')->updateOrInsert(
                    [
                        'game_job_id' => $jobId,
                        'equipment_type_id' => $equipmentTypeId,
                    ],
                    []
                );
            }
        }
    }

    private function normalizeJobName(string $jobName): string
    {
        return match ($jobName) {
            '魔法' => '魔法使い',
            '魔法戦士(スキル)' => '魔法戦士',
            default => $jobName,
        };
    }
}