<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $indexes = collect(DB::select('SHOW INDEX FROM monsters'))->pluck('Key_name')->unique()->values()->all();

        Schema::table('monsters', function (Blueprint $table) use ($indexes) {
            if (in_array('monsters_name_unique', $indexes, true)) {
                $table->dropUnique('monsters_name_unique');
            }

            if (! in_array('monsters_monster_no_unique', $indexes, true)) {
                $table->unique('monster_no', 'monsters_monster_no_unique');
            }
        });
    }

    public function down(): void
    {
        $indexes = collect(DB::select('SHOW INDEX FROM monsters'))->pluck('Key_name')->unique()->values()->all();

        Schema::table('monsters', function (Blueprint $table) use ($indexes) {
            if (in_array('monsters_monster_no_unique', $indexes, true)) {
                $table->dropUnique('monsters_monster_no_unique');
            }

            if (! in_array('monsters_name_unique', $indexes, true)) {
                $table->unique('name', 'monsters_name_unique');
            }
        });
    }
};