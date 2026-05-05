<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            $table->unsignedInteger('attack')->nullable()->after('id');
            $table->unsignedInteger('defense')->nullable()->after('attack');
            $table->unsignedInteger('max_hp')->nullable()->after('defense');
            $table->unsignedInteger('max_mp')->nullable()->after('max_hp');
            $table->unsignedInteger('charm')->nullable()->after('max_mp');

            $table->unsignedInteger('agility')->nullable()->after('charm');
            $table->unsignedInteger('dexterity')->nullable()->after('agility');
            $table->unsignedInteger('magic_attack')->nullable()->after('dexterity');
            $table->unsignedInteger('healing_power')->nullable()->after('magic_attack');
        });
    }

    public function down(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            $table->dropColumn([
                'attack',
                'defense',
                'max_hp',
                'max_mp',
                'charm',
                'agility',
                'dexterity',
                'magic_attack',
                'healing_power',
            ]);
        });
    }
};