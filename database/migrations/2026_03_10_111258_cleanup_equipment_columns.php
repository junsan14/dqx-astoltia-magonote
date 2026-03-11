<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            if (Schema::hasColumn('equipments', 'effect')) {
                $table->dropColumn('effect');
            }

            if (Schema::hasColumn('equipments', 'artisan_level_text')) {
                $table->dropColumn('artisan_level_text');
            }

            if (Schema::hasColumn('equipments', 'stats_json')) {
                $table->dropColumn('stats_json');
            }
        });

        // item_id の長さが足りない環境向けに念のため調整したいなら使う
        // Schema::table('equipments', function (Blueprint $table) {
        //     $table->string('item_id', 255)->change();
        // });
    }

    public function down(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            if (!Schema::hasColumn('equipments', 'effect')) {
                $table->text('effect')->nullable()->after('description');
            }

            if (!Schema::hasColumn('equipments', 'artisan_level_text')) {
                $table->string('artisan_level_text')->nullable()->after('effects_json');
            }

            if (!Schema::hasColumn('equipments', 'stats_json')) {
                $table->json('stats_json')->nullable()->after('effects_json');
            }
        });
    }
};