<?php

namespace App\Console\Commands;

use App\Services\MonsterHabitatSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncReincarnationHabitats extends Command
{
    protected $signature = 'monsters:sync-reincarnation-habitats {--apply : 転生元の生息地で既存データを同期する}';
    protected $description = '転生モンスターの生息地を転生元と揃える（通常は対象件数のみ表示）';

    public function handle(MonsterHabitatSyncService $service): int
    {
        $ids = DB::table('monsters')->whereNotNull('reincarnation_parent_id')->pluck('id');
        $this->info('対象: ' . $ids->count() . '体');
        if (!$this->option('apply')) {
            $this->info('--apply を付けると同期します。転生側だけにある生息地は削除されます。');
            return self::SUCCESS;
        }
        DB::transaction(function () use ($ids, $service) {
            foreach ($ids as $id) {
                $service->sync((int) $id);
            }
        });
        $this->info('生息地の同期が完了しました。');
        return self::SUCCESS;
    }
}
