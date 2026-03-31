<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;


return new class extends Migration
{
    public function up(): void
    {
        // 念のため、残骸の foreign key を先に削除
        try {
            DB::statement('ALTER TABLE maps DROP FOREIGN KEY maps_continent_id_foreign');
        } catch (\Throwable $e) {
        }

        try {
            DB::statement('ALTER TABLE maps DROP INDEX maps_continent_id_foreign');
        } catch (\Throwable $e) {
        }

        // continent_id カラム追加（まだ外部キーは張らない）
        if (!Schema::hasColumn('maps', 'continent_id')) {
            Schema::table('maps', function (Blueprint $table) {
                $table->unsignedBigInteger('continent_id')->nullable()->after('id');
            });
        }

        // 既存の continent 文字列一覧から continents を作成
        if (Schema::hasColumn('maps', 'continent')) {
            $continents = DB::table('maps')
                ->whereNotNull('continent')
                ->distinct()
                ->orderBy('continent')
                ->pluck('continent');

            $maxDisplayId = (int) (DB::table('continents')->max('display_id') ?? 0);
            $nextDisplayId = $maxDisplayId + 1;

            foreach ($continents as $continentName) {
                $existing = DB::table('continents')
                    ->where('name', $continentName)
                    ->first();

                if (!$existing) {
                    DB::table('continents')->insert([
                        'display_id' => $nextDisplayId++,
                        'name' => $continentName,
                        'name_en' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            // maps.continent_id を埋める
            $maps = DB::table('maps')->select('id', 'continent')->get();

            foreach ($maps as $map) {
                if (!$map->continent) {
                    continue;
                }

                $continent = DB::table('continents')
                    ->where('name', $map->continent)
                    ->first();

                if ($continent) {
                    DB::table('maps')
                        ->where('id', $map->id)
                        ->update(['continent_id' => $continent->id]);
                }
            }
        }

        // 未設定があれば止める
        $missingCount = DB::table('maps')->whereNull('continent_id')->count();
        if ($missingCount > 0) {
            throw new RuntimeException("continent_id を設定できなかった maps が {$missingCount} 件ある");
        }

        // 旧 unique(continent, name) を削除
        try {
            Schema::table('maps', function (Blueprint $table) {
                $table->dropUnique('maps_continent_name_unique');
            });
        } catch (\Throwable $e) {
        }

        // 旧 continent カラム削除
        if (Schema::hasColumn('maps', 'continent')) {
            Schema::table('maps', function (Blueprint $table) {
                $table->dropColumn('continent');
            });
        }

        // NOT NULL 化
        DB::statement('ALTER TABLE maps MODIFY continent_id BIGINT UNSIGNED NOT NULL');

        // 新しい FK を追加
        DB::statement('
            ALTER TABLE maps
            ADD CONSTRAINT maps_continent_id_foreign
            FOREIGN KEY (continent_id) REFERENCES continents(id)
            ON DELETE CASCADE
        ');

        // 新しい unique
        Schema::table('maps', function (Blueprint $table) {
            $table->unique(['continent_id', 'name'], 'maps_continent_id_name_unique');
        });
    }

    public function down(): void
    {
        // continent カラム復元
        if (!Schema::hasColumn('maps', 'continent')) {
            Schema::table('maps', function (Blueprint $table) {
                $table->string('continent')->nullable()->after('id');
            });
        }

        // continent_id -> continent 復元
        $maps = DB::table('maps')->select('id', 'continent_id')->get();

        foreach ($maps as $map) {
            if (!$map->continent_id) {
                continue;
            }

            $continent = DB::table('continents')->where('id', $map->continent_id)->first();

            if ($continent) {
                DB::table('maps')
                    ->where('id', $map->id)
                    ->update(['continent' => $continent->name]);
            }
        }

        try {
            Schema::table('maps', function (Blueprint $table) {
                $table->dropUnique('maps_continent_id_name_unique');
            });
        } catch (\Throwable $e) {
        }

        try {
            DB::statement('ALTER TABLE maps DROP FOREIGN KEY maps_continent_id_foreign');
        } catch (\Throwable $e) {
        }

        try {
            DB::statement('ALTER TABLE maps DROP INDEX maps_continent_id_foreign');
        } catch (\Throwable $e) {
        }

        if (Schema::hasColumn('maps', 'continent_id')) {
            Schema::table('maps', function (Blueprint $table) {
                $table->dropColumn('continent_id');
            });
        }

        Schema::table('maps', function (Blueprint $table) {
            $table->unique(['continent', 'name'], 'maps_continent_name_unique');
        });
    }
};