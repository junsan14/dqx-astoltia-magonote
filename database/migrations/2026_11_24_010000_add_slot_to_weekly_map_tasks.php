<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::table('weekly_map_tasks', function(Blueprint $table) {
            $table->unsignedTinyInteger('slot')->default(1);
            $table->dropUnique(['week_start','category']);
            $table->unique(['week_start','category','slot']);
        });
    }
    public function down(): void {
        // Preserve second-slot data: require an explicit cleanup before rollback.
        if (\Illuminate\Support\Facades\DB::table('weekly_map_tasks')->where('slot',2)->exists()) {
            throw new \RuntimeException('Second-slot tasks exist; archive them before rolling back.');
        }
        Schema::table('weekly_map_tasks', function(Blueprint $table) {
            $table->dropUnique(['week_start','category','slot']);
            $table->dropColumn('slot');
            $table->unique(['week_start','category']);
        });
    }
};
