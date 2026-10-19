<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AnnouncementTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        (require database_path('migrations/2026_10_19_000000_create_announcements_table.php'))->up();
        (require database_path('migrations/2026_10_19_010000_add_announcement_link_support.php'))->up();
    }

    private function admin(): void
    {
        $this->actingAs((new User)->forceFill(['id' => 1, 'is_admin' => true]));
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'locale' => 'ja', 'category' => 'fix', 'page_label' => 'モンスター検索',
            'page_path' => '/tools/monster-search', 'title' => 'ドロップ情報を修正',
            'body' => '手動で編集した本文', 'is_published' => false,
        ], $overrides);
    }

    public function test_only_published_current_locale_entries_are_public(): void
    {
        foreach ([['ja', null], ['ja', now()->addDay()], ['en', now()], ['ja', now()->subDay()]] as [$locale, $date]) {
            Announcement::create(array_merge($this->payload(), ['locale' => $locale, 'published_at' => $date]));
        }
        $this->getJson('/api/announcements?locale=ja')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.locale', 'ja');
    }

    public function test_admin_can_save_edit_publish_and_unpublish(): void
    {
        $this->admin();
        $id = $this->postJson('/api/admin/announcements', $this->payload())->assertCreated()->json('data.id');
        $this->getJson('/api/announcements')->assertJsonCount(0, 'data');
        $this->putJson('/api/admin/announcements/'.$id, $this->payload(['is_published' => true, 'body' => '編集後']))->assertOk();
        $this->getJson('/api/announcements')->assertJsonPath('data.0.body', '編集後');
        $this->putJson('/api/admin/announcements/'.$id, $this->payload())->assertOk();
        $this->getJson('/api/announcements')->assertJsonCount(0, 'data');
    }

    public function test_admin_endpoints_reject_guests_and_non_admins(): void
    {
        $this->postJson('/api/admin/announcements', $this->payload())->assertUnauthorized();
        $this->actingAs((new User)->forceFill(['id' => 2, 'is_admin' => false]));
        $this->getJson('/api/admin/announcements')->assertForbidden();
        $this->getJson('/api/admin/announcements/candidates')->assertForbidden();
        $this->postJson('/api/admin/announcements', $this->payload())->assertForbidden();
        $this->admin();
        $id = $this->postJson('/api/admin/announcements', $this->payload())->json('data.id');
        $this->actingAs((new User)->forceFill(['id' => 2, 'is_admin' => false]));
        $this->putJson('/api/admin/announcements/'.$id, $this->payload())->assertForbidden();
    }

    public function test_invalid_links_and_empty_content_are_rejected(): void
    {
        $this->admin();
        foreach (['//example.com', 'javascript:alert(1)', '/tools/../admin'] as $path) {
            $this->postJson('/api/admin/announcements', $this->payload(['page_path' => $path]))->assertUnprocessable()->assertJsonValidationErrors('page_path');
        }
        $this->postJson('/api/admin/announcements', $this->payload(['title' => '', 'body' => '']))->assertJsonValidationErrors(['title', 'body']);
    }

    public function test_recent_database_updates_provide_editable_defaults_without_saving(): void
    {
        $this->admin();
        foreach (['monsters', 'maps', 'orbs', 'items', 'equipments', 'accessories'] as $table) {
            Schema::create($table, function (Blueprint $blueprint) use ($table) {
                $blueprint->id(); $blueprint->string($table === 'equipments' ? 'item_name' : 'name'); $blueprint->timestamps();
                if ($table === 'equipments') $blueprint->unsignedBigInteger('craft_product_type_id')->nullable();
            });
        }
        Schema::create('craft_product_types', function (Blueprint $table) {
            $table->id(); $table->unsignedBigInteger('craft_type_id');
        });
        Schema::create('craft_types', function (Blueprint $table) {
            $table->id(); $table->timestamps();
        });
        DB::table('equipments')->insert(['item_name' => 'テスト装備', 'updated_at' => now()->subHour()]);
        DB::table('monsters')->insert(['id' => 84, 'name' => 'スライム', 'updated_at' => now()]);
        DB::table('monsters')->insert(['name' => '古いデータ', 'updated_at' => now()->subDays(31)]);
        $this->getJson('/api/admin/announcements/candidates')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.1.title', 'テスト装備の装備・職人データを更新しました')->assertJsonPath('data.0.title', 'スライムの情報を更新しました')
            ->assertJsonPath('data.0.page_path', '/tools/monster-search/84');
        $this->postJson('/api/admin/announcements', $this->payload(['page_path' => '/tools/monster-search/84', 'is_published' => true]))
            ->assertCreated()->assertJsonPath('data.page_path', '/tools/monster-search/84');
        $this->getJson('/api/announcements')->assertJsonPath('data.0.page_path', '/tools/monster-search/84');
        $this->assertDatabaseCount('announcements', 1);
    }
}
