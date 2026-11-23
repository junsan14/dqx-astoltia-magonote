<?php
namespace Tests\Feature;
use App\Models\User;
use App\Models\WeeklyMapTask;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;
class WeeklyMapTaskTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();
        foreach(['continents','maps','monster_system_types'] as $name) {
            Schema::create($name,function(Blueprint $t) use($name){$t->id();$t->string('name');$t->string('name_en')->nullable();$t->integer('display_order')->default(0);if($name==='maps'){$t->integer('continent_id');$t->string('map_type');}});
        }
        DB::table('continents')->insert([['id'=>1,'name'=>'魔界'],['id'=>2,'name'=>'天星郷']]);
        DB::table('maps')->insert(['id'=>1,'name'=>'ジャリムバハ砂漠','continent_id'=>1,'map_type'=>'field']);
        DB::table('monster_system_types')->insert(['id'=>1,'name'=>'怪人系','name_en'=>'Humanoid']);
        (require database_path('migrations/2026_11_24_000000_create_weekly_map_tasks_table.php'))->up();
        (require database_path('migrations/2026_11_24_010000_add_slot_to_weekly_map_tasks.php'))->up();
        Carbon::setTestNow(Carbon::parse('2026-11-24 12:00:00','Asia/Tokyo'));
    }
    protected function tearDown(): void {Carbon::setTestNow();parent::tearDown();}
    private function payload(array $overrides=[]): array {return array_merge(['week_start'=>'2026-11-22','category'=>'scribe','body'=>'ジャリムバハ砂漠にいるモンスターを２０匹討伐する。','body_en'=>null,'continent_id'=>1,'search_mode'=>'map','map_id'=>1,'monster_system_type_id'=>null,'is_published'=>true],$overrides);}
    private function admin(): void {$this->actingAs((new User)->forceFill(['id'=>1,'is_admin'=>true]));}
    public function test_authorization(): void {
        $this->putJson('/api/admin/weekly-map-tasks',$this->payload())->assertUnauthorized();
        $this->actingAs((new User)->forceFill(['id'=>2,'is_admin'=>false]));
        $this->getJson('/api/admin/weekly-map-tasks')->assertForbidden();
        $this->putJson('/api/admin/weekly-map-tasks',$this->payload())->assertForbidden();
    }
    public function test_save_overwrite_draft_and_filters(): void {
        $this->admin();
        $this->putJson('/api/admin/weekly-map-tasks',$this->payload())->assertOk();
        $this->getJson('/api/weekly-map-tasks')->assertJsonPath('data.0.map_id',1);
        $this->putJson('/api/admin/weekly-map-tasks',$this->payload(['is_published'=>false]))->assertOk();
        $this->assertSame(1,WeeklyMapTask::count());
        $this->getJson('/api/weekly-map-tasks')->assertJsonCount(0,'data');
        $this->putJson('/api/admin/weekly-map-tasks',$this->payload(['category'=>'fitness','continent_id'=>2,'search_mode'=>'system','map_id'=>null,'monster_system_type_id'=>1]))->assertOk();
        $this->getJson('/api/weekly-map-tasks?locale=en')->assertJsonPath('data.0.system_type','Humanoid')->assertJsonPath('data.0.map_id',null);
        $this->getJson('/api/admin/weekly-map-tasks')->assertOk()->assertJsonCount(2,'data');
    }
    public function test_two_slots_remain_independent(): void {
        $this->admin();
        $this->putJson('/api/admin/weekly-map-tasks',$this->payload())->assertOk();
        $this->putJson('/api/admin/weekly-map-tasks',$this->payload(['slot'=>2,'search_mode'=>'system','map_id'=>null,'monster_system_type_id'=>1]))->assertOk();
        $this->getJson('/api/weekly-map-tasks')->assertJsonCount(2,'data')->assertJsonPath('data.0.slot',1)->assertJsonPath('data.1.slot',2);
        $this->putJson('/api/admin/weekly-map-tasks',$this->payload(['slot'=>2,'is_published'=>false]))->assertOk();
        $this->getJson('/api/weekly-map-tasks')->assertJsonCount(1,'data')->assertJsonPath('data.0.slot',1);
        $this->assertSame(2,WeeklyMapTask::count());
    }
    public function test_validation(): void {
        $this->admin();
        foreach ([['slot'=>3],['continent_id'=>2],['week_start'=>'2026-11-23'],['search_mode'=>'system','map_id'=>null],['body'=>''],['map_id'=>999]] as $override) {
            $this->putJson('/api/admin/weekly-map-tasks',$this->payload($override))->assertUnprocessable();
        }
    }
    public function test_week_boundary_and_no_stale_fallback(): void {
        WeeklyMapTask::create($this->payload(['week_start'=>'2026-11-15']));
        WeeklyMapTask::create($this->payload());
        WeeklyMapTask::create($this->payload(['week_start'=>'2026-11-29']));
        Carbon::setTestNow(Carbon::parse('2026-11-22 05:59:59','Asia/Tokyo'));
        $this->getJson('/api/weekly-map-tasks')->assertJsonPath('week_start','2026-11-15')->assertJsonCount(1,'data');
        Carbon::setTestNow(Carbon::parse('2026-11-22 06:00:00','Asia/Tokyo'));
        $this->getJson('/api/weekly-map-tasks')->assertJsonPath('week_start','2026-11-22')->assertJsonCount(1,'data');
        Carbon::setTestNow(Carbon::parse('2026-12-06 06:00:00','Asia/Tokyo'));
        $this->getJson('/api/weekly-map-tasks')->assertJsonCount(0,'data');
    }
}
