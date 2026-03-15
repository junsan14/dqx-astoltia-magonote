<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('map_layers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('map_id')->constrained('maps')->cascadeOnDelete();
                $table->string('layer_name')->nullable();
                $table->integer('floor_no')->default(0);
                $table->string('image_path')->nullable();
                $table->string('source_url')->nullable();
                $table->unsignedInteger('display_order')->default(1);
                $table->timestamps();

                $table->index('map_id');
                $table->index(['map_id', 'display_order']);
                $table->index(['map_id', 'floor_no']);
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_layers');
    }
};
