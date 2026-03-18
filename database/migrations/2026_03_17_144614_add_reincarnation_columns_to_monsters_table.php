<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monsters', function (Blueprint $table) {
            $table->boolean('is_reincarnated')
                ->default(false)
                ->after('system_type')
                ->comment('転生モンスターかどうか');

            $table->unsignedBigInteger('reincarnation_parent_id')
                ->nullable()
                ->after('is_reincarnated')
                ->comment('転生元モンスターID');

            $table->foreign('reincarnation_parent_id')
                ->references('id')
                ->on('monsters')
                ->nullOnDelete();

            $table->index('is_reincarnated');
            $table->index('reincarnation_parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('monsters', function (Blueprint $table) {
            $table->dropForeign(['reincarnation_parent_id']);
            $table->dropIndex(['is_reincarnated']);
            $table->dropIndex(['reincarnation_parent_id']);

            $table->dropColumn(['is_reincarnated', 'reincarnation_parent_id']);
        });
    }
};