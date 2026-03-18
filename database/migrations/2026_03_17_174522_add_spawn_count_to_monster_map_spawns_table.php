<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            $table
                ->string('spawn_count', 255)
                ->nullable()
                ->after('spawn_time')
                ->comment('出現数。例: 1, 2, 1〜2, 2-3, 多数');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            $table->dropColumn('spawn_count');
        });
    }
};