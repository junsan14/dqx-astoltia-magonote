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

            $table->string('area')->nullable();

            $table->timestamps();

            $table->unique(['monster_id','map_id','area']);

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monster_map_spawns');
    }
};