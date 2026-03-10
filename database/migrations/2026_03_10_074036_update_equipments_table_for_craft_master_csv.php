<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            // 既存カラム整理
            $table->dropColumn([
                'name',
                'slot',
                'category',
                'level',
            ]);
        });

        Schema::table('equipments', function (Blueprint $table) {
            $table->string('item_id')->unique()->after('id');
            $table->string('item_name')->after('item_id');
            $table->string('item_kind')->nullable()->after('item_name');
            $table->string('item_type_key')->nullable()->after('item_kind');
            $table->string('item_type')->nullable()->after('item_type_key');
            $table->string('craft_type')->nullable()->after('item_type');
            $table->unsignedInteger('craft_level')->nullable()->after('craft_type');
            $table->unsignedInteger('equip_level')->nullable()->after('craft_level');
            $table->string('recipe_book')->nullable()->after('equip_level');
            $table->string('slot')->nullable()->after('recipe_book');
            $table->string('slot_grid_type')->nullable()->after('slot');
            $table->unsignedInteger('slot_grid_cols')->nullable()->after('slot_grid_type');
            $table->string('group_kind')->nullable()->after('slot_grid_cols');
            $table->string('group_id')->nullable()->after('group_kind');
            $table->string('group_name')->nullable()->after('group_id');
            $table->unsignedInteger('items_count')->nullable()->after('group_name');
            $table->string('crystal_by_alchemy')->nullable()->after('items_count');
            $table->json('materials_json')->nullable()->after('crystal_by_alchemy');
            $table->json('slot_grid_json')->nullable()->after('materials_json');
            $table->json('jobs_json')->nullable()->after('slot_grid_json');
            $table->string('equipable_type')->nullable()->after('jobs_json');
        });
    }

    public function down(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            $table->dropColumn([
                'item_id',
                'item_name',
                'item_kind',
                'item_type_key',
                'item_type',
                'craft_type',
                'craft_level',
                'equip_level',
                'recipe_book',
                'slot',
                'slot_grid_type',
                'slot_grid_cols',
                'group_kind',
                'group_id',
                'group_name',
                'items_count',
                'crystal_by_alchemy',
                'materials_json',
                'slot_grid_json',
                'jobs_json',
                'equipable_type',
            ]);
        });

        Schema::table('equipments', function (Blueprint $table) {
            $table->string('name');
            $table->string('slot')->nullable();
            $table->string('category')->nullable();
            $table->integer('level')->nullable();
        });
    }
};
