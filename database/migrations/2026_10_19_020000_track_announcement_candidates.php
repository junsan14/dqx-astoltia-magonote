<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->json('source_refs')->nullable();
        });
        Schema::create('announcement_candidate_receipts', function (Blueprint $table) {
            $table->string('source_key', 120);
            $table->timestamp('source_updated_at');
            $table->primary(['source_key', 'source_updated_at'], 'announcement_candidate_receipts_primary');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_candidate_receipts');
        Schema::table('announcements', fn (Blueprint $table) => $table->dropColumn('source_refs'));
    }
};
