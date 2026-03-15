<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            $table->unsignedBigInteger('map_layer_id')
                ->nullable()
                ->after('map_id');

            $table->foreign('map_layer_id')
                ->references('id')
                ->on('map_layers')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            $table->dropForeign(['map_layer_id']);
            $table->dropColumn('map_layer_id');
        });
    }
};