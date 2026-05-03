<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kishoju_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kishoju_room_id')
                ->constrained('kishoju_rooms')
                ->cascadeOnDelete();

            $table->unsignedTinyInteger('server_no');
            $table->string('map_name');
            $table->string('gauge_color');
            $table->string('reported_by');
            $table->text('memo')->nullable();
            $table->timestamps();

            $table->index(['kishoju_room_id', 'server_no']);
            $table->index(['kishoju_room_id', 'gauge_color']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kishoju_reports');
    }
};