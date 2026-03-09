<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monster_white_boxes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('monster_id')->constrained()->cascadeOnDelete();
            $table->string('item_name');
            $table->timestamps();

            $table->unique(['monster_id', 'item_name']);
            $table->index('item_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monster_white_boxes');
    }
};