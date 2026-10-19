<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->text('page_path')->nullable()->change();
        });
        Schema::create('announcement_drop_changes', function (Blueprint $table) {
            $table->id();
            $table->string('target_type', 20);
            $table->unsignedBigInteger('target_id');
            $table->timestamps();
            $table->unique(['target_type', 'target_id']);
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_drop_changes');
        // Keep the wider URL column so existing query links are not truncated.
    }
};
