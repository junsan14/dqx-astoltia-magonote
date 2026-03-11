<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accessories', function (Blueprint $table) {
            $table->id();
            $table->string('item_id')->unique();
            $table->string('name');
            $table->string('item_kind')->default('accessory');
            $table->string('slot')->nullable();
            $table->string('accessory_type')->nullable();
            $table->integer('equip_level')->nullable();
            $table->text('description')->nullable();
            $table->json('effects_json')->nullable();
            $table->json('synthesis_effects_json')->nullable();
            $table->json('obtain_methods_json')->nullable();
            $table->string('image_url')->nullable();
            $table->string('source_url')->nullable();
            $table->string('detail_url')->nullable()->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accessories');
    }
};