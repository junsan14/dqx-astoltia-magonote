<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
public function up()
{
    Schema::table('monsters', function (Blueprint $table) {
        $table->dropColumn(['normal_drop','rare_drop']);
    });
}

public function down()
{
    Schema::table('monsters', function (Blueprint $table) {
        $table->string('normal_drop')->nullable();
        $table->string('rare_drop')->nullable();
    });
}
};
