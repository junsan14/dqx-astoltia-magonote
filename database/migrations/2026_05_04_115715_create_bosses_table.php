<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bosses', function (Blueprint $table) {
            $table->id();

            // 表示用
            $table->string('boss_id')->unique(); // regnade, gardodon など
            $table->string('name');
            $table->string('name_en')->nullable();

            // 分類
            $table->string('category')->nullable(); 
            // coin_boss, end_content, story_boss, field_boss など

            $table->string('series')->nullable();
            // 常闇, 聖守護者, 咎人, コインボス など

            $table->string('race')->nullable();
            // ドラゴン系, けもの系, あくま系 など

            $table->string('image_url')->nullable();
            $table->string('source_url')->nullable();

            $table->text('description')->nullable();
            $table->text('note')->nullable();

            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bosses');
    }
};