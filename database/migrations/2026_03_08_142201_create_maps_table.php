<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maps', function (Blueprint $table) {
            $table->id();

            $table->string('continent');
            $table->string('name');
            $table->string('map_type');

            $table->string('source_url')->nullable();

            $table->timestamps();

            $table->unique(['continent','name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maps');
    }
};