<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class BossPushWeightSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        /**
         * 前回入れた「レグナード1-4」みたいな古いまとめデータを削除
         */
        $oldBossIds = [
            'regnald_1_4',
            'regnald_5',
            'galdodon_1_4',
            'regirazzo_4',
            'regirazzo_3',
            'roghast_4',
            'roghast_3',
        ];

        DB::transaction(function () use ($oldBossIds, $now) {
            $oldBossPrimaryIds = DB::table('bosses')
                ->whereIn('boss_id', $oldBossIds)
                ->pluck('id');

            if ($oldBossPrimaryIds->isNotEmpty()) {
                DB::table('boss_push_weights')
                    ->whereIn('boss_id', $oldBossPrimaryIds)
                    ->delete();

                DB::table('boss_stats')
                    ->whereIn('boss_id', $oldBossPrimaryIds)
                    ->delete();

                DB::table('bosses')
                    ->whereIn('id', $oldBossPrimaryIds)
                    ->delete();
            }

            $bosses = [
                [
                    'boss_id' => 'hakai_shin_sido',
                    'name' => '破壊神シドー',
                    'sort_order' => 10,
                    'variants' => [
                        null => [
                            'disadvantage_weight' => 1867,
                            'equal_weight' => 2100,
                            'win_weight' => 2593,
                            'complete_weight' => 2917,
                            'wb_disadvantage_weight' => 2800,
                            'wb_equal_weight' => 3150,
                            'wb_win_weight' => 3889,
                            'wb_complete_weight' => 4375,
                        ],
                    ],
                ],

                [
                    'boss_id' => 'regnald',
                    'name' => 'レグナード',
                    'sort_order' => 20,
                    'variants' => [
                        '1' => [
                            'disadvantage_weight' => 647,
                            'equal_weight' => 728,
                            'win_weight' => 898,
                            'complete_weight' => 1010,
                            'wb_disadvantage_weight' => 970,
                            'wb_equal_weight' => 1091,
                            'wb_win_weight' => 1347,
                            'wb_complete_weight' => 1515,
                            'note' => 'レグナード1-4共通',
                        ],
                        '2' => [
                            'disadvantage_weight' => 647,
                            'equal_weight' => 728,
                            'win_weight' => 898,
                            'complete_weight' => 1010,
                            'wb_disadvantage_weight' => 970,
                            'wb_equal_weight' => 1091,
                            'wb_win_weight' => 1347,
                            'wb_complete_weight' => 1515,
                            'note' => 'レグナード1-4共通',
                        ],
                        '3' => [
                            'disadvantage_weight' => 647,
                            'equal_weight' => 728,
                            'win_weight' => 898,
                            'complete_weight' => 1010,
                            'wb_disadvantage_weight' => 970,
                            'wb_equal_weight' => 1091,
                            'wb_win_weight' => 1347,
                            'wb_complete_weight' => 1515,
                            'note' => 'レグナード1-4共通',
                        ],
                        '4' => [
                            'disadvantage_weight' => 647,
                            'equal_weight' => 728,
                            'win_weight' => 898,
                            'complete_weight' => 1010,
                            'wb_disadvantage_weight' => 970,
                            'wb_equal_weight' => 1091,
                            'wb_win_weight' => 1347,
                            'wb_complete_weight' => 1515,
                            'note' => 'レグナード1-4共通',
                        ],
                        '5' => [
                            'disadvantage_weight' => 982,
                            'equal_weight' => 1104,
                            'win_weight' => 1363,
                            'complete_weight' => 1534,
                            'wb_disadvantage_weight' => 1472,
                            'wb_equal_weight' => 1656,
                            'wb_win_weight' => 2045,
                            'wb_complete_weight' => 2300,
                        ],
                    ],
                ],

                [
                    'boss_id' => 'ultimate_evil_priest',
                    'name' => '究極エビルプリースト',
                    'sort_order' => 30,
                    'variants' => [
                        null => [
                            'disadvantage_weight' => 1595,
                            'equal_weight' => 1794,
                            'win_weight' => 2215,
                            'complete_weight' => 2492,
                            'wb_disadvantage_weight' => 2392,
                            'wb_equal_weight' => 2691,
                            'wb_win_weight' => 3323,
                            'wb_complete_weight' => 3738,
                        ],
                    ],
                ],

                [
                    'boss_id' => 'gao_gosnell',
                    'name' => '牙王ゴースネル',
                    'sort_order' => 40,
                    'variants' => [
                        null => [
                            'disadvantage_weight' => 658,
                            'equal_weight' => 740,
                            'win_weight' => 913,
                            'complete_weight' => 1027,
                            'wb_disadvantage_weight' => 986,
                            'wb_equal_weight' => 1109,
                            'wb_win_weight' => 1369,
                            'wb_complete_weight' => 1540,
                        ],
                    ],
                ],

                [
                    'boss_id' => 'galdodon',
                    'name' => '剛獣鬼ガルドドン',
                    'sort_order' => 50,
                    'variants' => [
                        '1' => [
                            'disadvantage_weight' => 1014,
                            'equal_weight' => 1140,
                            'win_weight' => 1408,
                            'complete_weight' => 1584,
                            'wb_disadvantage_weight' => 1520,
                            'wb_equal_weight' => 1710,
                            'wb_win_weight' => 2112,
                            'wb_complete_weight' => 2375,
                            'note' => '剛獣鬼ガルドドン1-4共通',
                        ],
                        '2' => [
                            'disadvantage_weight' => 1014,
                            'equal_weight' => 1140,
                            'win_weight' => 1408,
                            'complete_weight' => 1584,
                            'wb_disadvantage_weight' => 1520,
                            'wb_equal_weight' => 1710,
                            'wb_win_weight' => 2112,
                            'wb_complete_weight' => 2375,
                            'note' => '剛獣鬼ガルドドン1-4共通',
                        ],
                        '3' => [
                            'disadvantage_weight' => 1014,
                            'equal_weight' => 1140,
                            'win_weight' => 1408,
                            'complete_weight' => 1584,
                            'wb_disadvantage_weight' => 1520,
                            'wb_equal_weight' => 1710,
                            'wb_win_weight' => 2112,
                            'wb_complete_weight' => 2375,
                            'note' => '剛獣鬼ガルドドン1-4共通',
                        ],
                        '4' => [
                            'disadvantage_weight' => 1014,
                            'equal_weight' => 1140,
                            'win_weight' => 1408,
                            'complete_weight' => 1584,
                            'wb_disadvantage_weight' => 1520,
                            'wb_equal_weight' => 1710,
                            'wb_win_weight' => 2112,
                            'wb_complete_weight' => 2375,
                            'note' => '剛獣鬼ガルドドン1-4共通',
                        ],
                    ],
                ],

                [
                    'boss_id' => 'regirazzo',
                    'name' => '冥骸魔レギルラッゾ',
                    'sort_order' => 60,
                    'variants' => [
                        '3' => [
                            'disadvantage_weight' => 808,
                            'equal_weight' => 909,
                            'win_weight' => 1123,
                            'complete_weight' => 1263,
                            'wb_disadvantage_weight' => 1212,
                            'wb_equal_weight' => 1364,
                            'wb_win_weight' => 1684,
                            'wb_complete_weight' => 1894,
                        ],
                        '4' => [
                            'disadvantage_weight' => 526,
                            'equal_weight' => 591,
                            'win_weight' => 730,
                            'complete_weight' => 821,
                            'wb_disadvantage_weight' => 788,
                            'wb_equal_weight' => 887,
                            'wb_win_weight' => 1095,
                            'wb_complete_weight' => 1232,
                        ],
                    ],
                ],

                [
                    'boss_id' => 'roghast',
                    'name' => '獣魔ローガスト',
                    'sort_order' => 70,
                    'variants' => [
                        '3' => [
                            'disadvantage_weight' => 457,
                            'equal_weight' => 514,
                            'win_weight' => 635,
                            'complete_weight' => 714,
                            'wb_disadvantage_weight' => 685,
                            'wb_equal_weight' => 771,
                            'wb_win_weight' => 952,
                            'wb_complete_weight' => 1070,
                        ],
                        '4' => [
                            'disadvantage_weight' => 344,
                            'equal_weight' => 387,
                            'win_weight' => 478,
                            'complete_weight' => 537,
                            'wb_disadvantage_weight' => 516,
                            'wb_equal_weight' => 580,
                            'wb_win_weight' => 716,
                            'wb_complete_weight' => 805,
                        ],
                    ],
                ],
            ];

            foreach ($bosses as $bossData) {
                DB::table('bosses')->updateOrInsert(
                    [
                        'boss_id' => $bossData['boss_id'],
                    ],
                    [
                        'name' => $bossData['name'],
                        'name_en' => null,
                        'category' => 'weight_checker',
                        'series' => 'dq10',
                        'race' => null,
                        'image_url' => null,
                        'source_url' => null,
                        'description' => null,
                        'note' => null,
                        'is_active' => true,
                        'sort_order' => $bossData['sort_order'],
                        'updated_at' => $now,
                    ]
                );

                $boss = DB::table('bosses')
                    ->where('boss_id', $bossData['boss_id'])
                    ->first();

                foreach ($bossData['variants'] as $variant => $weights) {
                    DB::table('boss_push_weights')->updateOrInsert(
                        [
                            'boss_id' => $boss->id,
                            'variant' => $variant,
                        ],
                        [
                            'disadvantage_weight' => $weights['disadvantage_weight'],
                            'equal_weight' => $weights['equal_weight'],
                            'win_weight' => $weights['win_weight'],
                            'complete_weight' => $weights['complete_weight'],

                            'wb_disadvantage_weight' => $weights['wb_disadvantage_weight'],
                            'wb_equal_weight' => $weights['wb_equal_weight'],
                            'wb_win_weight' => $weights['wb_win_weight'],
                            'wb_complete_weight' => $weights['wb_complete_weight'],

                            'note' => $weights['note'] ?? null,
                            'updated_at' => $now,
                        ]
                    );
                }
            }
        });
    }
}