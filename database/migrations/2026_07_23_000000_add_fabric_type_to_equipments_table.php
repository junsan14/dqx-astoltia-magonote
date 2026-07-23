<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            $table
                ->string('fabric_type')
                ->nullable()
                ->after('equipment_type_id')
                ->comment('裁縫装備の布タイプ（再生布・虹布など）');
        });
    }

    public function down(): void
    {
        Schema::table('equipments', function (Blueprint $table) {
            $table->dropColumn('fabric_type');
        });
    }
};
