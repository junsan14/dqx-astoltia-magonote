<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {

            $table->string('spawn_time')
                ->default('normal')
                ->after('area');

            $table->string('spawn_count')
                ->nullable()
                ->after('spawn_time');

        });
    }

    public function down(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {

            $table->dropColumn('spawn_time');
            $table->dropColumn('spawn_count');

        });
    }
};