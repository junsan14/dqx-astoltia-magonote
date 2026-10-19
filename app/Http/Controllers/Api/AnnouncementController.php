<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
        return Announcement::select(['id', 'locale', 'category', 'page_label', 'page_path', 'title', 'body', 'published_at', 'created_at', 'updated_at'])->where('locale', $input['locale'] ?? 'ja')
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
        $filter = $request->validate([
            'target_type' => ['nullable', Rule::in(['monster', 'map', 'orb', 'item', 'equipment', 'accessory'])],
            'target_id' => ['required_with:target_type', 'nullable', 'integer', 'min:1'],
        ]);
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
            if (!empty($filter['target_type']) && $filter['target_type'] !== $type) continue;
            $rows = DB::table($table)->select('id', $nameColumn.' as name', 'updated_at')
                ->where('updated_at', '>=', now()->subDays(30))
                ->when($filter['target_id'] ?? null, fn ($query, $id) => $query->where('id', $id))
                ->orderByDesc('updated_at')->orderByDesc('id')->get();
            foreach ($rows as $row) {
                $candidates->push($this->candidate($type, $row, $type === 'equipment' ? 'craft' : 'data'));
            }
            if (!in_array($type, ['orb', 'item', 'equipment', 'accessory'], true)) continue;
            $drops = DB::table('announcement_drop_changes as changes')
                ->join($table.' as target', 'target.id', '=', 'changes.target_id')
                ->where('changes.target_type', $type)
                ->when($filter['target_id'] ?? null, fn ($query, $id) => $query->where('target.id', $id))
                ->where('changes.updated_at', '>=', now()->subDays(30))
                ->select('target.id', 'target.'.$nameColumn.' as name', 'changes.updated_at')
                ->orderByDesc('changes.updated_at')->get();
            foreach ($drops as $row) $candidates->push($this->candidate($type, $row, 'drops'));
        }

        // Success rates live on the craft type, so equipment.updated_at alone
        // cannot discover these changes. Offer the affected equipment links.
        $craftUpdates = DB::table('equipments as equipment')
            ->join('craft_product_types as product', 'product.id', '=', 'equipment.craft_product_type_id')
            ->join('craft_types as craft', 'craft.id', '=', 'product.craft_type_id')
            ->where('craft.updated_at', '>=', now()->subDays(30))
            ->when(!empty($filter['target_type']) && $filter['target_type'] !== 'equipment', fn ($query) => $query->whereRaw('1 = 0'))
            ->when($filter['target_id'] ?? null, fn ($query, $id) => $query->where('equipment.id', $id))
            ->select('equipment.id', 'equipment.item_name as name', 'craft.updated_at')
            ->orderByDesc('craft.updated_at')->orderByDesc('equipment.id')->get();
        foreach ($craftUpdates as $row) $candidates->push($this->candidate('equipment', $row, 'craft-rate'));

        $receipts = DB::table('announcement_candidate_receipts')
            ->where('source_updated_at', '>=', now()->subDays(31))->get()
            ->mapWithKeys(fn ($row) => [$row->source_key.'|'.$row->source_updated_at => true]);
        $remaining = $candidates->reject(function ($candidate) use ($receipts) {
            $source = $candidate['source_refs'][0];
            return $receipts->has($source['key'].'|'.$source['updated_at']);
        });
        return response()->json(['data' => $remaining->sortByDesc('updated_at')->take(50)->values()]);
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
            'target_type' => $type, 'target_name' => $row->name,
            'source_refs' => [['key' => $type.':'.$row->id.':'.$context, 'updated_at' => Carbon::parse($row->updated_at)->format('Y-m-d H:i:s')]],
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
            'category' => ['required', Rule::in(['update', 'fix', 'feature', 'new_info'])],
            'page_label' => ['required', 'string', 'max:100'],
            // Only locale-independent, internal tool paths are accepted.
            'page_path' => ['nullable', 'string', 'max:2048', 'regex:#^/tools/[a-z0-9/-]+(?:\?[a-zA-Z0-9_%+&=.,:;@!()/~-]*)?$#D'],
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:10000'],
            'is_published' => ['required', 'boolean'],
            ...$this->sourceRules(),
        ]);
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $this->validated($request);
        $data['published_at'] = $data['is_published'] ? now() : null;
        unset($data['is_published']);
        $announcement = DB::transaction(function () use ($data) {
            $announcement = Announcement::create($data);
            if ($announcement->published_at) $this->consumeSources($announcement->source_refs ?? []);
            return $announcement;
        });
        return response()->json(['data' => $announcement], 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $this->authorizeAdmin($request);
        $data = $this->validated($request);
        $data['published_at'] = $data['is_published'] ? ($announcement->published_at ?? now()) : null;
        unset($data['is_published']);
        DB::transaction(function () use ($announcement, $data) {
            $announcement->update($data);
            if ($announcement->published_at) $this->consumeSources($announcement->source_refs ?? []);
        });
        return response()->json(['data' => $announcement->fresh()]);
    }

    private function sourceRules(): array
    {
        return [
            'source_refs' => ['sometimes', 'nullable', 'array', 'max:50'],
            'source_refs.*.key' => ['required', 'string', 'max:120', 'regex:/^(monster|map|orb|item|equipment|accessory):[1-9][0-9]*:(data|craft|drops|craft-rate)$/'],
            'source_refs.*.updated_at' => ['required', 'date'],
        ];
    }

    private function consumeSources(array $sources): void
    {
        foreach ($sources as $source) {
            DB::table('announcement_candidate_receipts')->insertOrIgnore([
                'source_key' => $source['key'],
                'source_updated_at' => Carbon::parse($source['updated_at'])->format('Y-m-d H:i:s'),
            ]);
        }
    }

    public function dismissCandidate(Request $request)
    {
        $this->authorizeAdmin($request);
        $rules = $this->sourceRules();
        $rules['source_refs'] = ['required', 'array', 'min:1', 'max:50'];
        $data = $request->validate($rules);
        $this->consumeSources($data['source_refs']);
        return response()->json(['message' => '文面候補から外しました。']);
    }

}
