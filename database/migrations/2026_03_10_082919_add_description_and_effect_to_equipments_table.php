<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            if (!Schema::hasColumn('equipments', 'description')) {
                $table->text('description')->nullable()->after('recipe_place');
            }

            if (!Schema::hasColumn('equipments', 'effect')) {
                $table->text('effect')->nullable()->after('description');
            }
        });
    }

    public function down(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            if (Schema::hasColumn('equipments', 'description')) {
                $table->dropColumn('description');
            }

            if (Schema::hasColumn('equipments', 'effect')) {
                $table->dropColumn('effect');
            }
        });
    }
};
