<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\WeeklyMapTask;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WeeklyMapTaskController extends Controller {
    private function currentWeek(): string {
        return Carbon::now('Asia/Tokyo')->subHours(6)->startOfWeek(Carbon::SUNDAY)->toDateString();
    }
    private function week(Request $request): string {
        $data = $request->validate(['week_start' => ['sometimes','required','date_format:Y-m-d']]);
        $week = $data['week_start'] ?? $this->currentWeek();
        if (!Carbon::parse($week, 'Asia/Tokyo')->isSunday()) {
            throw ValidationException::withMessages(['week_start' => '対象週の日曜日を指定してください。']);
        }
        return $week;
    }
    private function admin(Request $request): void { abort_unless($request->user()?->is_admin, 403); }
    public function index(Request $request) {
        $locale = $request->validate(['locale' => ['sometimes', Rule::in(['ja','en'])]])['locale'] ?? 'ja';
        $week = $this->currentWeek();
        $rows = WeeklyMapTask::with('systemType')->where('week_start', $week)->where('is_published', true)->orderBy('slot')->get();
        return response()->json(['week_start' => $week, 'data' => $rows->map(function ($row) use ($locale) {
            return ['id'=>$row->id, 'slot'=>(int)$row->slot, 'category'=>$row->category, 'body'=>($locale === 'en' && $row->body_en ? $row->body_en : $row->body),
                'continent_id'=>$row->continent_id, 'search_mode'=>$row->search_mode, 'map_id'=>$row->map_id,
                'system_type'=>$locale === 'en' ? ($row->systemType?->name_en ?: $row->systemType?->name) : $row->systemType?->name];
        })])->header('Cache-Control', 'no-store');
    }
    public function adminIndex(Request $request) {
        $this->admin($request);
        $week = $this->week($request);
        return response()->json(['week_start'=>$week, 'data'=>WeeklyMapTask::where('week_start',$week)->get(),
            'continents'=>DB::table('continents')->orderBy('display_order')->get(['id','name']),
            'maps'=>DB::table('maps')->whereIn('map_type',['field','dungeon','フィールド','ダンジョン'])->orderBy('name')->get(['id','name','continent_id']),
            'systems'=>DB::table('monster_system_types')->orderBy('display_order')->get(['id','name'])])->header('Cache-Control','no-store');
    }
    public function save(Request $request) {
        $this->admin($request);
        $week = $this->week($request);
        $data = $request->validate([
            'week_start'=>['required','date_format:Y-m-d'],
            'category'=>['required',Rule::in(['fitness','scribe'])],
            'slot'=>['sometimes','integer',Rule::in([1,2])],
            'body'=>['required','string','max:1000'], 'body_en'=>['nullable','string','max:1000'],
            'continent_id'=>['required','integer','exists:continents,id'],
            'search_mode'=>['required',Rule::in(['map','system'])],
            'map_id'=>['nullable','required_if:search_mode,map','integer', Rule::exists('maps','id')->where(fn($q)=>$q->where('continent_id',$request->input('continent_id'))->whereIn('map_type',['field','dungeon','フィールド','ダンジョン']))],
            'monster_system_type_id'=>['nullable','required_if:search_mode,system','integer','exists:monster_system_types,id'],
            'is_published'=>['required','boolean'],
        ]);
        $data['monster_system_type_id'] = $data['search_mode'] === 'system' ? $data['monster_system_type_id'] : null;
        $data['map_id'] = $data['search_mode'] === 'map' ? $data['map_id'] : null;
        $data['slot'] = $data['slot'] ?? 1;
        $row = WeeklyMapTask::updateOrCreate(['week_start'=>$week,'category'=>$data['category'],'slot'=>$data['slot']],$data);
        return response()->json(['data'=>$row]);
    }
}
