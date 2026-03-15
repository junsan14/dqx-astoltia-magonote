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
    $table->unique(
        ['monster_id', 'map_id', 'map_layer_id', 'spawn_time'],
        'monster_map_spawns_monster_id_map_id_layer_id_spawn_time_unique'
    );
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            //
        });
    }
};
