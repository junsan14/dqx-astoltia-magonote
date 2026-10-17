<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\MonsterMapSpawnController;
use App\Services\MonsterHabitatSyncService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class MonsterHabitatSyncTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');
        Schema::create('monsters', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('reincarnation_parent_id')->nullable();
        });
        Schema::create('monster_map_spawns', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('monster_id');
            $table->unsignedBigInteger('map_id');
            $table->unsignedBigInteger('map_layer_id')->nullable();
            $table->string('spawn_time');
            $table->text('area')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
            $table->unique(['monster_id', 'map_id', 'map_layer_id', 'spawn_time']);
        });
        DB::table('monsters')->insert([
            ['id' => 1, 'reincarnation_parent_id' => null],
            ['id' => 2, 'reincarnation_parent_id' => 1],
            ['id' => 3, 'reincarnation_parent_id' => 2],
            ['id' => 4, 'reincarnation_parent_id' => null],
        ]);
    }

    private function spawn(int $monsterId, string $time = '昼', ?int $layer = 10): int
    {
        return DB::table('monster_map_spawns')->insertGetId([
            'monster_id' => $monsterId, 'map_id' => 1, 'map_layer_id' => $layer,
            'spawn_time' => $time, 'area' => '["A1"]', 'note' => '親の備考',
        ]);
    }

    public function test_sync_copies_distinct_times_and_preserves_ids_on_repeat(): void
    {
        $this->spawn(1);
        $this->spawn(1, '夜');
        $this->spawn(1, 'いつでも', null);
        $service = app(MonsterHabitatSyncService::class);
        $service->sync(2);
        $ids = DB::table('monster_map_spawns')->where('monster_id', 2)->pluck('id')->all();
        $this->assertCount(3, $ids);
        $this->assertSame(3, DB::table('monster_map_spawns')->where('monster_id', 3)->count());
        $service->sync(1);
        $this->assertSame($ids, DB::table('monster_map_spawns')->where('monster_id', 2)->pluck('id')->all());
        $this->assertSame('親の備考', DB::table('monster_map_spawns')->where('monster_id', 2)->value('note'));
    }

    public function test_parent_edits_deletes_and_switches_replace_child_habitats(): void
    {
        $id = $this->spawn(1);
        $this->spawn(2, '古い生息地');
        $service = app(MonsterHabitatSyncService::class);
        $service->sync(2);
        DB::table('monster_map_spawns')->where('id', $id)->update(['area' => '["B2"]']);
        $service->sync(1);
        $this->assertSame('["B2"]', DB::table('monster_map_spawns')->where('monster_id', 2)->value('area'));
        $this->assertSame(1, DB::table('monster_map_spawns')->where('monster_id', 2)->count());
        DB::table('monster_map_spawns')->where('id', $id)->delete();
        $service->sync(1);
        $this->assertSame(0, DB::table('monster_map_spawns')->count());
        $this->spawn(4, '夜');
        DB::table('monsters')->where('id', 2)->update(['reincarnation_parent_id' => 4]);
        $service->sync(2);
        $this->assertSame('夜', DB::table('monster_map_spawns')->where('monster_id', 3)->value('spawn_time'));
    }

    public function test_cycle_rejects_the_transaction(): void
    {
        $this->spawn(1);
        try {
            DB::transaction(function () {
                DB::table('monsters')->where('id', 1)->update(['reincarnation_parent_id' => 3]);
                app(MonsterHabitatSyncService::class)->sync(1);
            });
            $this->fail('循環参照が拒否されなかった');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('reincarnation_parent_id', $e->errors());
        }
        $this->assertNull(DB::table('monsters')->where('id', 1)->value('reincarnation_parent_id'));
        $this->assertSame(1, DB::table('monster_map_spawns')->count());
    }

    public function test_child_habitat_cannot_be_deleted_directly(): void
    {
        $id = $this->spawn(2);
        $this->expectException(ValidationException::class);
        app(MonsterMapSpawnController::class)->destroy((string) $id);
    }

    public function test_backfill_is_preview_only_without_apply(): void
    {
        $this->spawn(1);
        $this->artisan('monsters:sync-reincarnation-habitats')->assertSuccessful();
        $this->assertSame(1, DB::table('monster_map_spawns')->count());
        $this->artisan('monsters:sync-reincarnation-habitats', ['--apply' => true])->assertSuccessful();
        $this->assertSame(3, DB::table('monster_map_spawns')->count());
    }
}
