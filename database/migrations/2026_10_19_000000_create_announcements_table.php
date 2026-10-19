<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('locale', 2)->default('ja');
            $table->string('category', 20)->default('update');
            $table->string('page_label', 100);
            $table->string('page_path', 255)->nullable();
            $table->string('title', 200);
            $table->text('body');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->index(['locale', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};
