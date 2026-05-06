<?php

namespace App\Console\Commands;

use App\Models\Equipment;
use App\Models\GameJob;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ApplyLegacyEquipmentJobOverrides extends Command
{
    protected $signature = 'dqx:apply-legacy-equipment-job-overrides
                            {--dry-run : 実際には保存せず確認だけする}
                            {--clear : 対象装備の既存overrideを削除して入れ直す}';

    protected $description = '古い防具セットの装備可能職を equipment_job_overrides に replace 方式で登録する';

    private Collection $allJobs;

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $clear = (bool) $this->option('clear');

        $legacySets = $this->legacyEquipmentSets();

        $this->allJobs = GameJob::query()
            ->orderBy('id')
            ->get();

        $jobsByName = $this->allJobs->keyBy('name');

        $this->info('Legacy equipment job override import started.');
        $this->line('dry-run: ' . ($dryRun ? 'yes' : 'no'));
        $this->line('clear: ' . ($clear ? 'yes' : 'no'));
        $this->newLine();

        $updatedEquipmentCount = 0;
        $createdOverrideCount = 0;
        $notFoundSetNames = [];
        $missingJobs = [];

        DB::beginTransaction();

        try {
            foreach ($legacySets as $setName => $config) {
                $aliases = $config['aliases'] ?? [$setName];
                $jobNames = $config['jobs'] ?? [];

                $equipments = $this->findEquipmentsByAliases($aliases);

                if ($equipments->isEmpty()) {
                    $notFoundSetNames[] = $setName;
                    $this->warn("Not found: {$setName}");
                    $this->line('  aliases: ' . implode(', ', $aliases));
                    continue;
                }

                $newGameJobIds = [];

                foreach ($jobNames as $jobName) {
                    $job = $jobsByName->get($jobName);

                    if (!$job) {
                        $missingJobs[$jobName] = true;
                        continue;
                    }

                    $newGameJobIds[] = $job->id;
                }

                $newGameJobIds = array_values(array_unique($newGameJobIds));
                $newJobNames = $this->jobNamesByIds($newGameJobIds);

                $this->newLine();
                $this->info("Set: {$setName}");
                $this->line('Aliases: ' . implode(', ', $aliases));
                $this->line('Matched equipments: ' . $equipments->count());

                foreach ($equipments as $equipment) {
                    $currentJobNames = $this->getCurrentEquipableJobNames($equipment);

                    $this->newLine();
                    $this->line("- [{$equipment->id}] {$equipment->item_name} / group: {$equipment->group_name}");
                    $this->line("  Current mode: {$equipment->job_override_mode}");
                    $this->line('  Current jobs:');
                    $this->line('    ' . $this->formatJobNames($currentJobNames));

                    $this->line('  New mode:');
                    $this->line('    replace');

                    $this->line('  New jobs:');
                    $this->line('    ' . $this->formatJobNames($newJobNames));

                    $added = array_values(array_diff($newJobNames, $currentJobNames));
                    $removed = array_values(array_diff($currentJobNames, $newJobNames));

                    $this->line('  Diff:');

                    if (empty($added) && empty($removed)) {
                        $this->line('    no change');
                    } else {
                        $this->line('    add: ' . $this->formatJobNames($added));
                        $this->line('    remove: ' . $this->formatJobNames($removed));
                    }

                    if (!$dryRun) {
                        $equipment->job_override_mode = 'replace';
                        $equipment->save();

                        if ($clear) {
                            DB::table('equipment_job_overrides')
                                ->where('equipment_id', $equipment->id)
                                ->delete();
                        }

                        foreach ($newGameJobIds as $gameJobId) {
                            DB::table('equipment_job_overrides')->updateOrInsert(
                                [
                                    'equipment_id' => $equipment->id,
                                    'game_job_id' => $gameJobId,
                                    'mode' => 'allow',
                                ],
                                [
                                    'created_at' => now(),
                                    'updated_at' => now(),
                                ]
                            );

                            $createdOverrideCount++;
                        }
                    }

                    $updatedEquipmentCount++;
                }
            }

            if ($dryRun) {
                DB::rollBack();
                $this->newLine();
                $this->comment('Dry run finished. No data was saved.');
            } else {
                DB::commit();
                $this->newLine();
                $this->info('Saved successfully.');
            }

            $this->newLine();
            $this->info("Updated equipments: {$updatedEquipmentCount}");
            $this->info("Created/updated overrides: {$createdOverrideCount}");

            if (!empty($missingJobs)) {
                $this->newLine();
                $this->warn('Missing game_jobs:');
                foreach (array_keys($missingJobs) as $jobName) {
                    $this->line("- {$jobName}");
                }
            }

            if (!empty($notFoundSetNames)) {
                $this->newLine();
                $this->warn('Not found equipment sets:');
                foreach ($notFoundSetNames as $setName) {
                    $this->line("- {$setName}");
                }
            }

            return self::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();

            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }

    private function getCurrentEquipableJobNames(Equipment $equipment): array
    {
        $baseJobIds = [];

        if ($equipment->equipment_type_id) {
            $baseJobIds = DB::table('equipable_types')
                ->where('equipment_type_id', $equipment->equipment_type_id)
                ->pluck('game_job_id')
                ->toArray();
        }

        $allowJobIds = DB::table('equipment_job_overrides')
            ->where('equipment_id', $equipment->id)
            ->where('mode', 'allow')
            ->pluck('game_job_id')
            ->toArray();

        $denyJobIds = DB::table('equipment_job_overrides')
            ->where('equipment_id', $equipment->id)
            ->where('mode', 'deny')
            ->pluck('game_job_id')
            ->toArray();

        if ($equipment->job_override_mode === 'replace') {
            $jobIds = $allowJobIds;
        } elseif ($equipment->job_override_mode === 'add') {
            $jobIds = collect($baseJobIds)
                ->merge($allowJobIds)
                ->unique()
                ->reject(fn ($id) => in_array($id, $denyJobIds))
                ->values()
                ->toArray();
        } else {
            $jobIds = $baseJobIds;
        }

        return $this->jobNamesByIds($jobIds);
    }

    private function jobNamesByIds(array $jobIds): array
    {
        $jobIds = array_values(array_unique($jobIds));

        return $this->allJobs
            ->whereIn('id', $jobIds)
            ->sortBy('id')
            ->pluck('name')
            ->values()
            ->toArray();
    }

    private function formatJobNames(array $jobNames): string
    {
        if (empty($jobNames)) {
            return '(none)';
        }

        return implode(', ', $jobNames);
    }

    private function findEquipmentsByAliases(array $aliases)
    {
        $keywords = collect($aliases)
            ->flatMap(function (string $alias) {
                return $this->makeSearchKeywords($alias);
            })
            ->unique()
            ->values()
            ->all();

        return Equipment::query()
            ->where(function ($query) use ($keywords) {
                foreach ($keywords as $keyword) {
                    $query
                        ->orWhere('group_name', $keyword)
                        ->orWhere('group_name', 'like', "%{$keyword}%")
                        ->orWhere('item_name', $keyword)
                        ->orWhere('item_name', 'like', "{$keyword}%")
                        ->orWhere('item_name', 'like', "%{$keyword}%");
                }
            })
            ->orderBy('id')
            ->get();
    }

    private function makeSearchKeywords(string $name): array
    {
        $base = trim($name);

        $withoutSet = str_replace('セット', '', $base);
        $withoutNo = str_replace('の', '', $withoutSet);

        return array_values(array_filter(array_unique([
            $base,
            $withoutSet,
            $withoutNo,
        ])));
    }

    private function legacyEquipmentSets(): array
    {
        return [
            '皮のよろいセット' => [
                'aliases' => [
                    '皮のよろいセット',
                    '皮セット',
                    '皮',
                ],
                'jobs' => [
                    '戦士',
                    '僧侶',
                    '盗賊',
                    '旅芸人',
                    'バトルマスター',
                    'パラディン',
                    '魔法戦士',
                    'レンジャー',
                    'スーパースター',
                    'まもの使い',
                    'どうぐ使い',
                    '踊り子',
                    '遊び人',
                    '魔剣士',
                    '海賊',
                    'ガーディアン',
                ],
            ],

            '前座芸人の服セット' => [
                'aliases' => [
                    '前座芸人の服セット',
                    '前座芸人セット',
                    '前座芸人',
                ],
                'jobs' => [
                    '武闘家',
                    '盗賊',
                    '旅芸人',
                    'バトルマスター',
                    'レンジャー',
                    'スーパースター',
                    'まもの使い',
                    'どうぐ使い',
                    '踊り子',
                    '遊び人',
                    '海賊',
                ],
            ],

            '麻の服セット' => [
                'aliases' => [
                    '麻の服セット',
                    '麻セット',
                    '麻',
                ],
                'jobs' => [
                    '僧侶',
                    '魔法使い',
                    '旅芸人',
                    'レンジャー',
                    '賢者',
                    '踊り子',
                    '占い師',
                    '天地雷鳴士',
                    'デスマスター',
                    '竜術士',
                    '隠者',
                ],
            ],

            'くさりかたびらセット' => [
                'aliases' => [
                    'くさりかたびらセット',
                    'くさりセット',
                    'くさり',
                    '鎖',
                ],
                'jobs' => [
                    '戦士',
                    '僧侶',
                    '武闘家',
                    '盗賊',
                    '旅芸人',
                    'バトルマスター',
                    'パラディン',
                    '魔法戦士',
                    'レンジャー',
                    'まもの使い',
                    'どうぐ使い',
                    '踊り子',
                    '魔剣士',
                    '海賊',
                    'ガーディアン',
                ],
            ],

            'みかわしの服セット' => [
                'aliases' => [
                    'みかわしの服セット',
                    'みかわしセット',
                    'みかわし',
                ],
                'jobs' => [
                    '僧侶',
                    '魔法使い',
                    '武闘家',
                    '盗賊',
                    '旅芸人',
                    'レンジャー',
                    '賢者',
                    'スーパースター',
                    '踊り子',
                    '占い師',
                    '天地雷鳴士',
                    '遊び人',
                    'デスマスター',
                    '海賊',
                    '竜術士',
                    '隠者',
                ],
            ],

            'きじゅつしの服セット' => [
                'aliases' => [
                    'きじゅつしの服セット',
                    'きじゅつしセット',
                    'きじゅつし',
                    '奇術師',
                ],
                'jobs' => [
                    '僧侶',
                    '魔法使い',
                    '武闘家',
                    '旅芸人',
                    '魔法戦士',
                    'レンジャー',
                    'スーパースター',
                    '踊り子',
                    '占い師',
                    '天地雷鳴士',
                    '遊び人',
                    'デスマスター',
                    '竜術士',
                    '隠者',
                ],
            ],

            'マスターベストセット' => [
                'aliases' => [
                    'マスターベストセット',
                    'マスターセット',
                    'マスター',
                ],
                'jobs' => [
                    '旅芸人',
                    '魔法戦士',
                    'スーパースター',
                    'どうぐ使い',
                    '踊り子',
                    '遊び人',
                ],
            ],

            '無法者のベストセット' => [
                'aliases' => [
                    '無法者のベストセット',
                    '無法者セット',
                    '無法者',
                ],
                'jobs' => [
                    '武闘家',
                    '盗賊',
                    'バトルマスター',
                    'レンジャー',
                    'まもの使い',
                    '踊り子',
                    '海賊',
                ],
            ],

            'トレジャーコートセット' => [
                'aliases' => [
                    'トレジャーコートセット',
                    'トレジャーセット',
                    'トレジャー',
                ],
                'jobs' => [
                    '盗賊',
                    'レンジャー',
                    'どうぐ使い',
                    '海賊',
                ],
            ],

            'バトルドレスセット' => [
                'aliases' => [
                    'バトルドレスセット',
                    'バトルセット',
                    'バトルドレス',
                ],
                'jobs' => [
                    '武闘家',
                    'バトルマスター',
                    'まもの使い',
                    '踊り子',
                ],
            ],

            'ファントムマントセット' => [
                'aliases' => [
                    'ファントムマントセット',
                    'ファントムセット',
                    'ファントム',
                ],
                'jobs' => [
                    '旅芸人',
                    '魔法戦士',
                    'スーパースター',
                    '踊り子',
                    '遊び人',
                ],
            ],

            '原始獣のコートセット' => [
                'aliases' => [
                    '原始獣のコートセット',
                    '原始獣セット',
                    '原始獣',
                ],
                'jobs' => [
                    '盗賊',
                    'バトルマスター',
                    'レンジャー',
                    'まもの使い',
                    '海賊',
                ],
            ],

            '古武道着セット' => [
                'aliases' => [
                    '古武道着セット',
                    '古武道セット',
                    '古武道',
                ],
                'jobs' => [
                    '武闘家',
                    '盗賊',
                    'まもの使い',
                    '踊り子',
                    '海賊',
                ],
            ],

            'ミラクルコートセット' => [
                'aliases' => [
                    'ミラクルコートセット',
                    'ミラクルセット',
                    'ミラクル',
                ],
                'jobs' => [
                    '旅芸人',
                    'レンジャー',
                    'スーパースター',
                    '踊り子',
                    '遊び人',
                ],
            ],

            'クラウンベストセット' => [
                'aliases' => [
                    'クラウンベストセット',
                    'クラウンセット',
                    'クラウン',
                ],
                'jobs' => [
                    '盗賊',
                    '旅芸人',
                    'スーパースター',
                    '踊り子',
                    '遊び人',
                    '海賊',
                ],
            ],

            'グレートマントセット' => [
                'aliases' => [
                    'グレートマントセット',
                    'グレートセット',
                    'グレート',
                ],
                'jobs' => [
                    '武闘家',
                    '盗賊',
                    'バトルマスター',
                    '踊り子',
                    '海賊',
                ],
            ],

            'ひつじのころもセット' => [
                'aliases' => [
                    'ひつじのころもセット',
                    'ひつじセット',
                    'ひつじ',
                ],
                'jobs' => [
                    '旅芸人',
                    'レンジャー',
                    'まもの使い',
                    '踊り子',
                ],
            ],

            'さすらいのコートセット' => [
                'aliases' => [
                    'さすらいのコートセット',
                    'さすらいセット',
                    'さすらい',
                ],
                'jobs' => [
                    '旅芸人',
                    '魔法戦士',
                    'レンジャー',
                    '踊り子',
                ],
            ],

            'タイフーンレザーセット' => [
                'aliases' => [
                    'タイフーンレザーセット',
                    'タイフーンセット',
                    'タイフーン',
                ],
                'jobs' => [
                    '盗賊',
                    'バトルマスター',
                    'どうぐ使い',
                    '海賊',
                ],
            ],

            '王軍師のよろいセット' => [
                'aliases' => [
                    '王軍師のよろいセット',
                    '王軍師セット',
                    '王軍師',
                ],
                'jobs' => [
                    '戦士',
                    'パラディン',
                    '魔法戦士',
                    '魔剣士',
                    'ガーディアン',
                ],
            ],

            'クリムゾンメイルセット' => [
                'aliases' => [
                    'クリムゾンメイルセット',
                    'クリムゾンセット',
                    'クリムゾン',
                ],
                'jobs' => [
                    '武闘家',
                    'バトルマスター',
                    'まもの使い',
                    '踊り子',
                ],
            ],

            'メカニックスーツセット' => [
                'aliases' => [
                    'メカニックスーツセット',
                    'メカニックセット',
                    'メカニック',
                    'メカニックスーツ',
                ],
                'jobs' => [
                    '盗賊',
                    'レンジャー',
                    'どうぐ使い',
                    '海賊',
                ],
            ],

            'レイブンスーツセット' => [
                'aliases' => [
                    'レイブンスーツセット',
                    'レイブンセット',
                    'レイブン',
                ],
                'jobs' => [
                    '旅芸人',
                    '魔法戦士',
                    'スーパースター',
                    '踊り子',
                    '遊び人',
                ],
            ],

            '退魔の装束セット' => [
                'aliases' => [
                    '退魔の装束セット',
                    '退魔セット',
                    '退魔',
                ],
                'jobs' => [
                    '僧侶',
                    '魔法使い',
                    '賢者',
                    '占い師',
                    '天地雷鳴士',
                    'デスマスター',
                    '竜術士',
                    '隠者',
                ],
            ],
        ];
    }
}