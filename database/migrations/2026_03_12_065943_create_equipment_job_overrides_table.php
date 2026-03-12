<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('equipment_job_overrides', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('equipment_id');
            $table->unsignedBigInteger('game_job_id');
            $table->enum('mode', ['allow', 'deny'])->default('allow');

            $table->timestamps();

            $table->foreign('equipment_id')
                ->references('id')
                ->on('equipments')
                ->cascadeOnDelete();

            $table->foreign('game_job_id')
                ->references('id')
                ->on('game_jobs')
                ->cascadeOnDelete();

            $table->unique(
                ['equipment_id', 'game_job_id', 'mode'],
                'equipment_job_overrides_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('equipment_job_overrides');
    }
};