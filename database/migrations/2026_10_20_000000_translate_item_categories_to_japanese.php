<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const CATEGORIES = [
        'consumable' => '消費アイテム',
        'recipe' => 'レシピ',
        'material' => '素材',
        'scout' => 'スカウトの書',
    ];

    public function up(): void
    {
        DB::transaction(function () {
            foreach (self::CATEGORIES as $english => $japanese) {
                DB::table('items')->where('category', $english)
                    ->update(['category' => $japanese]);
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            foreach (self::CATEGORIES as $english => $japanese) {
                DB::table('items')->where('category', $japanese)
                    ->update(['category' => $english]);
            }
        });
    }
};
