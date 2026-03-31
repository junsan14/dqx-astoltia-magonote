<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->string('name_en')->nullable()->after('name');
        });

        Schema::table('accessories', function (Blueprint $table) {
            $table->string('name_en')->nullable()->after('name');
        });

        Schema::table('orbs', function (Blueprint $table) {
            $table->string('name_en')->nullable()->after('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn('name_en');
        });

        Schema::table('accessories', function (Blueprint $table) {
            $table->dropColumn('name_en');
        });

        Schema::table('orbs', function (Blueprint $table) {
            $table->dropColumn('name_en');
        });
    }
};