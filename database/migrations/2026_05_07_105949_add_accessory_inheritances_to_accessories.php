<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accessories', function (Blueprint $table) {
            $table->foreignId('inheritance_from_accessory_id')
                ->nullable()
                ->after('accessory_type')
                ->constrained('accessories')
                ->nullOnDelete();

            $table->string('inheritance_type')
                ->nullable()
                ->after('inheritance_from_accessory_id');

            $table->text('inheritance_note')
                ->nullable()
                ->after('inheritance_type');
        });
    }

    public function down(): void
    {
        Schema::table('accessories', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inheritance_from_accessory_id');
            $table->dropColumn([
                'inheritance_type',
                'inheritance_note',
            ]);
        });
    }
};