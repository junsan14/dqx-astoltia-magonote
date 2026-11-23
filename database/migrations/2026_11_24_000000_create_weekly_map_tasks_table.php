<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('weekly_map_tasks', function (Blueprint $table) {
            $table->id();
            $table->date('week_start');
            $table->string('category', 20);
            $table->text('body');
            $table->text('body_en')->nullable();
            $table->foreignId('continent_id')->constrained()->restrictOnDelete();
            $table->string('search_mode', 10);
            $table->foreignId('map_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('monster_system_type_id')->nullable()->constrained()->restrictOnDelete();
            $table->boolean('is_published')->default(false);
            $table->timestamps();
            $table->unique(['week_start', 'category']);
        });
    }
    public function down(): void { Schema::dropIfExists('weekly_map_tasks'); }
};
