<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            $table->unsignedInteger('marker_x')->nullable()->after('spawn_count');
            $table->unsignedInteger('marker_y')->nullable()->after('marker_x');
        });
    }

    public function down(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            $table->dropColumn(['marker_x', 'marker_y']);
        });
    }
};