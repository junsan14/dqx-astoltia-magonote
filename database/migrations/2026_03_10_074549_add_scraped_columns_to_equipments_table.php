<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            $table->string('source_url')->nullable()->after('equipable_type');
            $table->string('detail_url')->nullable()->after('source_url');

            $table->json('effects_json')->nullable()->after('detail_url');
            $table->json('stats_json')->nullable()->after('effects_json');

            $table->string('recipe_place')->nullable()->after('recipe_book');
            $table->string('artisan_level_text')->nullable()->after('recipe_place');
        });
    }

    public function down(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            $table->dropColumn([
                'source_url',
                'detail_url',
                'effects_json',
                'stats_json',
                'recipe_place',
                'artisan_level_text',
            ]);
        });
    }
};
