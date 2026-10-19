<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $input = $request->validate([
            'locale' => ['sometimes', Rule::in(['ja', 'en'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);
        return Announcement::where('locale', $input['locale'] ?? 'ja')
            ->whereNotNull('published_at')->where('published_at', '<=', now())
            ->orderByDesc('published_at')->orderByDesc('id')
            ->paginate($input['per_page'] ?? 5);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->is_admin, 403);
    }

    public function adminIndex(Request $request)
    {
        $this->authorizeAdmin($request);
        return Announcement::latest('updated_at')->orderByDesc('id')->paginate(20);
    }

    public function candidates(Request $request)
    {
        $this->authorizeAdmin($request);
        $candidates = collect();
        $sources = [
            'monsters' => ['monster', 'name'],
            'maps' => ['map', 'name'],
            'orbs' => ['orb', 'name'],
            'items' => ['item', 'name'],
            'equipments' => ['equipment', 'item_name'],
            'accessories' => ['accessory', 'name'],
        ];
        foreach ($sources as $table => [$type, $nameColumn]) {
            $rows = DB::table($table)->select('id', $nameColumn.' as name', 'updated_at')
                ->where('updated_at', '>=', now()->subDays(30))
                ->orderByDesc('updated_at')->orderByDesc('id')->limit(20)->get();
            foreach ($rows as $row) {
                $candidates->push($this->candidate($type, $row, $type === 'equipment' ? 'craft' : 'data'));
            }
            if (!in_array($type, ['orb', 'item', 'equipment', 'accessory'], true)) continue;
            $drops = DB::table('announcement_drop_changes as changes')
                ->join($table.' as target', 'target.id', '=', 'changes.target_id')
                ->where('changes.target_type', $type)
                ->where('changes.updated_at', '>=', now()->subDays(30))
                ->select('target.id', 'target.'.$nameColumn.' as name', 'changes.updated_at')
                ->orderByDesc('changes.updated_at')->limit(20)->get();
            foreach ($drops as $row) $candidates->push($this->candidate($type, $row, 'drops'));
        }

        // Success rates live on the craft type, so equipment.updated_at alone
        // cannot discover these changes. Offer the affected equipment links.
        $craftUpdates = DB::table('equipments as equipment')
            ->join('craft_product_types as product', 'product.id', '=', 'equipment.craft_product_type_id')
            ->join('craft_types as craft', 'craft.id', '=', 'product.craft_type_id')
            ->where('craft.updated_at', '>=', now()->subDays(30))
            ->select('equipment.id', 'equipment.item_name as name', 'craft.updated_at')
            ->orderByDesc('craft.updated_at')->orderByDesc('equipment.id')->limit(20)->get();
        foreach ($craftUpdates as $row) $candidates->push($this->candidate('equipment', $row, 'craft-rate'));

        return response()->json(['data' => $candidates->sortByDesc('updated_at')->take(50)->values()]);
    }

    private function candidate(string $type, object $row, string $context): array
    {
        $searchPath = '/tools/monster-search?'.http_build_query([
            'type' => $type, 'q' => $row->name,
        ], '', '&', PHP_QUERY_RFC3986);
        $craftPath = '/tools/craft-profit?'.http_build_query(['q' => $row->name], '', '&', PHP_QUERY_RFC3986);
        $isCraft = in_array($context, ['craft', 'craft-rate'], true);
        $label = match ($type) {
            'monster' => 'モンスター詳細',
            'map' => 'マップ・モンスター検索',
            default => $isCraft ? '職人あれこれ' : 'モンスター検索',
        };
        $path = match ($type) {
            'monster' => '/tools/monster-search/'.$row->id,
            'map' => '/tools/map-monster-browser',
            default => $isCraft ? $craftPath : $searchPath,
        };
        $subject = match ($context) {
            'drops' => 'ドロップ情報',
            'craft-rate' => '職人種別の設定',
            'craft' => '装備・職人データ',
            default => '情報',
        };
        return [
            'key' => $type.':'.$row->id.':'.$context,
            'updated_at' => $row->updated_at,
            'locale' => 'ja', 'category' => 'update',
            'page_label' => $label, 'page_path' => $path,
            'title' => $row->name.'の'.$subject.'を更新しました',
            'body' => '「'.$row->name.'」の'.$subject.'を更新しました。',
            'link_options' => $type === 'equipment' ? [
                ['label' => 'ドロップ情報 → モンスター検索', 'page_label' => 'モンスター検索', 'page_path' => $searchPath],
                ['label' => '素材・職人用の数値 → 職人あれこれ', 'page_label' => '職人あれこれ', 'page_path' => $craftPath],
            ] : [],
        ];
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'locale' => ['required', Rule::in(['ja', 'en'])],
            'category' => ['required', Rule::in(['update', 'fix', 'feature'])],
            'page_label' => ['required', 'string', 'max:100'],
            // Only locale-independent, internal tool paths are accepted.
            'page_path' => ['nullable', 'string', 'max:2048', 'regex:#^/tools/[a-z0-9/-]+(?:\?[a-zA-Z0-9_%+&=.,:;@!()/~-]*)?$#D'],
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:10000'],
            'is_published' => ['required', 'boolean'],
        ]);
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $this->validated($request);
        $data['published_at'] = $data['is_published'] ? now() : null;
        unset($data['is_published']);
        return response()->json(['data' => Announcement::create($data)], 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $this->authorizeAdmin($request);
        $data = $this->validated($request);
        $data['published_at'] = $data['is_published'] ? ($announcement->published_at ?? now()) : null;
        unset($data['is_published']);
        $announcement->update($data);
        return response()->json(['data' => $announcement->fresh()]);
    }
}
