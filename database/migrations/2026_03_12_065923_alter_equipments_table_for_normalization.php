<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            $table->unsignedBigInteger('equipment_type_id')
                ->nullable()
                ->after('item_name');

            $table->enum('job_override_mode', ['inherit', 'add', 'replace'])
                ->default('inherit')
                ->after('equipment_type_id');
        });

        Schema::table('equipments', function (Blueprint $table) {
            $table->foreign('equipment_type_id')
                ->references('id')
                ->on('equipment_types')
                ->nullOnDelete();
        });

        Schema::table('equipments', function (Blueprint $table) {
            $table->dropColumn([
                'item_kind',
                'item_type_key',
                'item_type',
                'craft_type',
                'items_count',
                'crystal_by_alchemy',
                'jobs_json',
                'equipable_type',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            $table->string('item_kind')->nullable()->after('item_name');
            $table->string('item_type_key')->nullable()->after('item_kind');
            $table->string('item_type')->nullable()->after('item_type_key');
            $table->string('craft_type')->nullable()->after('item_type');
            $table->unsignedInteger('items_count')->nullable()->after('group_name');
            $table->string('crystal_by_alchemy')->nullable()->after('items_count');
            $table->json('jobs_json')->nullable()->after('slot_grid_json');
            $table->string('equipable_type')->nullable()->after('jobs_json');
        });

        Schema::table('equipments', function (Blueprint $table) {
            $table->dropForeign(['equipment_type_id']);
            $table->dropColumn([
                'equipment_type_id',
                'job_override_mode',
            ]);
        });
    }
};