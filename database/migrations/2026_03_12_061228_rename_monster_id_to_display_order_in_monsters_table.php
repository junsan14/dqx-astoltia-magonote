<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monsters', function (Blueprint $table) {

            // カラム名変更
            $table->renameColumn('monster_no', 'display_order');

        });

        // index追加
        Schema::table('monsters', function (Blueprint $table) {

            $table->unsignedInteger('display_order')->index()->change();

        });
    }

    public function down(): void
    {
        Schema::table('monsters', function (Blueprint $table) {

            $table->renameColumn('display_order', 'monster_no');

        });
    }
};