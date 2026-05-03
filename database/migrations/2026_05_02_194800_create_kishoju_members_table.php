<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kishoju_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kishoju_room_id')
                ->constrained('kishoju_rooms')
                ->cascadeOnDelete();

            $table->string('name');
            $table->unsignedTinyInteger('server_from')->nullable();
            $table->unsignedTinyInteger('server_to')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kishoju_members');
    }
};