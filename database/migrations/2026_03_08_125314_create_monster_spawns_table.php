<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monster_spawns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('monster_id')->constrained()->cascadeOnDelete();
            $table->string('location_name'); // 例: ランガーオ山地
            $table->string('area_note')->nullable(); // 例: 村付近、C-5あたり
            $table->string('time_zone')->nullable(); // 常時 / 昼のみ / 夜のみ
            $table->timestamps();

            $table->index('location_name');
            $table->index('time_zone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monster_spawns');
    }
};