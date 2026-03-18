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
                ->string('symbol_count', 255)
                ->nullable()
                ->after('spawn_count')
                ->comment('シンボル数。例: 1, 2, 1〜2, 多数');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            $table->dropColumn('symbol_count');
        });
    }
};