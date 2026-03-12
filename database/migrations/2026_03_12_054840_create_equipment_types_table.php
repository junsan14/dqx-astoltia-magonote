<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('equipment_types', function (Blueprint $table) {
            $table->id();

            $table->string('key')->unique();
            $table->string('name')->unique();

            $table->enum('kind', ['weapon', 'armor']);

            $table->foreignId('craft_type_id')
                ->nullable()
                ->constrained('craft_types')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('kind');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('equipment_types');
    }
};