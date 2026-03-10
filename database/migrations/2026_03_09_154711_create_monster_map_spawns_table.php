<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monster_map_spawns', function (Blueprint $table) {
            $table->id();

            $table->foreignId('monster_id')->constrained()->cascadeOnDelete();
            $table->foreignId('map_id')->constrained()->cascadeOnDelete();

            $table->longText('area')->nullable(); // JSON文字列を保存
            $table->string('spawn_time')->default('normal');
            $table->longText('note')->nullable(); // JSON文字列を保存

            $table->timestamps();

            $table->unique(
                ['monster_id', 'map_id', 'spawn_time'],
                'monster_map_spawns_monster_id_map_id_spawn_time_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monster_map_spawns');
    }
};