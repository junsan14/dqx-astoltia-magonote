<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monsters', function (Blueprint $table) {
            $table->text('trivia_1')->nullable()->after('image_path');
            $table->text('trivia_2')->nullable()->after('trivia_1');
        });
    }

    public function down(): void
    {
        Schema::table('monsters', function (Blueprint $table) {
            $table->dropColumn(['trivia_1', 'trivia_2']);
        });
    }
};