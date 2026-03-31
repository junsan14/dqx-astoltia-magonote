<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('continents', function (Blueprint $table) {
            $table->renameColumn('display_id', 'display_order');
        });
    }

    public function down(): void
    {
        Schema::table('continents', function (Blueprint $table) {
            $table->renameColumn('display_order', 'display_id');
        });
    }
};