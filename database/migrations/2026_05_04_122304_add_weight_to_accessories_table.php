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
    Schema::table('accessories', function (Blueprint $table) {
        $table->unsignedInteger('weight')->nullable()->after('equip_level');
    });
}

public function down(): void
{
    Schema::table('accessories', function (Blueprint $table) {
        $table->dropColumn('weight');
    });
}
};
