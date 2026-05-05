<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boss_stats', function (Blueprint $table) {
            $table->id();

            $table->foreignId('boss_id')
                ->constrained('bosses')
                ->cascadeOnDelete();

            // 難易度や強さ違いに対応
            $table->string('variant')->nullable();
            // I, II, III, IV, V, Normal, Strong など

            $table->unsignedInteger('level')->nullable();

            $table->unsignedInteger('hp')->nullable();
            $table->unsignedInteger('mp')->nullable();

            $table->unsignedInteger('attack')->nullable();
            $table->unsignedInteger('defense')->nullable();
            $table->unsignedInteger('magic_attack')->nullable();
            $table->unsignedInteger('magic_defense')->nullable();

            $table->unsignedInteger('agility')->nullable();
            $table->unsignedInteger('weight')->nullable();

            // 追加ステータス用
            $table->json('extra_stats_json')->nullable();

            $table->text('note')->nullable();

            $table->timestamps();

            $table->unique(['boss_id', 'variant']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boss_stats');
    }
};