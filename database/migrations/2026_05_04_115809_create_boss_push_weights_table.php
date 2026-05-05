<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boss_push_weights', function (Blueprint $table) {
            $table->id();

            $table->foreignId('boss_id')
                ->constrained('bosses')
                ->cascadeOnDelete();

            // boss_stats と同じ variant を使う
            $table->string('variant')->nullable();

            // 通常時の押し合いライン
            $table->unsignedInteger('disadvantage_weight')->nullable(); 
            $table->unsignedInteger('equal_weight')->nullable();
            $table->unsignedInteger('win_weight')->nullable();
            $table->unsignedInteger('complete_weight')->nullable();

            // ウェイトブレイク時など、特殊状態に対応したい場合
            $table->unsignedInteger('wb_disadvantage_weight')->nullable();
            $table->unsignedInteger('wb_equal_weight')->nullable();
            $table->unsignedInteger('wb_win_weight')->nullable();
            $table->unsignedInteger('wb_complete_weight')->nullable();

            $table->text('note')->nullable();

            $table->timestamps();

            $table->unique(['boss_id', 'variant']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boss_push_weights');
    }
};