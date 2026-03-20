<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            // 既存 note を imported_note に変更
            $table->renameColumn('note', 'imported_note');
        });

        Schema::table('monster_map_spawns', function (Blueprint $table) {
            // 新しい手動編集用 note
            $table->longText('note')->nullable()->after('symbol_count');

            // 狩場フラグ
            $table->boolean('is_hunting_ground')->default(false)->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('monster_map_spawns', function (Blueprint $table) {
            $table->dropColumn(['is_hunting_ground', 'note']);
        });

        Schema::table('monster_map_spawns', function (Blueprint $table) {
            $table->renameColumn('imported_note', 'note');
        });
    }
};