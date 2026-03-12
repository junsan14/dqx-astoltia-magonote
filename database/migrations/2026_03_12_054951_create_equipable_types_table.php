<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('equipable_types', function (Blueprint $table) {
            $table->id();

            $table->foreignId('game_job_id')
                ->constrained('game_jobs')
                ->cascadeOnDelete();

            $table->foreignId('equipment_type_id')
                ->constrained('equipment_types')
                ->cascadeOnDelete();

            $table->timestamps();

            $table->unique(['game_job_id', 'equipment_type_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('equipable_types');
    }
};