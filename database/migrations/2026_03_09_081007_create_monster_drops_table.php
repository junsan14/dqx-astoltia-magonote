<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monster_drops', function (Blueprint $table) {
            $table->id();

            $table->foreignId('monster_id')->constrained()->cascadeOnDelete();

            $table->string('drop_target_type'); // item / equipment / orb
            $table->unsignedBigInteger('drop_target_id');

            $table->string('drop_type'); // normal / rare / white_box / orb
            $table->unsignedInteger('sort_order')->nullable();

            $table->timestamps();

            $table->index(['monster_id']);
            $table->index(['drop_target_type', 'drop_target_id']);
            $table->index(['monster_id', 'drop_type']);

            $table->unique(
                ['monster_id', 'drop_target_type', 'drop_target_id', 'drop_type'],
                'monster_drop_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monster_drops');
    }
};
