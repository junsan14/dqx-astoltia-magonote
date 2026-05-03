<?php

namespace App\Http\Controllers\Api;
use App\Http\Requests\StoreAccessoryRequest;
use App\Http\Requests\UpdateAccessoryRequest;
use App\Models\Accessory;
use App\Models\Monster;
use App\Models\MonsterDrop;
use App\Services\MonsterDropSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccessoryController extends Controller
{
    public function __construct(
        private MonsterDropSyncService $monsterDropSyncService
    ) {}

    public function index(Request $request): JsonResponse
{
    $q = trim((string) $request->query('q', ''));

    $query = Accessory::query();

    if ($q !== '') {
        $escaped = addcslashes($q, '\\%_');

        $query->where(function ($sub) use ($escaped) {
            $sub->where('item_id', 'like', "%{$escaped}%")
                ->orWhere('name', 'like', "%{$escaped}%")
                ->orWhere('slot', 'like', "%{$escaped}%")
                ->orWhere('accessory_type', 'like', "%{$escaped}%")
                ->orWhere('description', 'like', "%{$escaped}%");
        })
        ->orderByRaw(
            "
            CASE
                WHEN name = ? THEN 0
                WHEN name LIKE ? THEN 1
                ELSE 2
            END
            ",
            [$q, $escaped . '%']
        )
        ->orderByRaw('LENGTH(name) ASC')
        ->orderBy('name');
    } else {
        $query->orderBy('name');
    }

    return response()->json([
        'data' => $query->get(),
    ]);
}

    public function show(Accessory $accessory): JsonResponse
    {
        return response()->json([
            'data' => $this->buildAccessoryResponse($accessory),
        ]);
    }

    public function store(StoreAccessoryRequest $request): JsonResponse
    {
        $validated = $request->validated();

        logger()->info('accessory store validated', $validated);

        $accessory = DB::transaction(function () use ($validated) {
            $accessory = Accessory::create([
                'item_id' => $validated['item_id'],
                'name' => $validated['name'],
                'item_kind' => $validated['item_kind'] ?? 'accessory',
                'slot' => $validated['slot'] ?? null,
                'accessory_type' => $validated['accessory_type'] ?? null,
                'equip_level' => $validated['equip_level'] ?? null,
                'description' => $validated['description'] ?? null,
                'effects_json' => $validated['effects_json'] ?? [],
                'synthesis_effects_json' => $validated['synthesis_effects_json'] ?? [],
                'obtain_methods_json' => $validated['obtain_methods_json'] ?? [],
                'image_url' => $validated['image_url'] ?? null,
                'source_url' => $validated['source_url'] ?? null,
                'detail_url' => $validated['detail_url'] ?? null,
            ]);

            $this->monsterDropSyncService->sync(
                'accessory',
                $accessory->id,
                $validated['drop_monsters'] ?? []
            );

            return $accessory;
        });

        return response()->json([
            'message' => 'アクセサリを作成した',
            'data' => $this->buildAccessoryResponse($accessory->fresh()),
        ], 201);
    }

    public function update(UpdateAccessoryRequest $request, Accessory $accessory): JsonResponse
    {
        $validated = $request->validated();

        logger()->info('accessory update validated', $validated);

        DB::transaction(function () use ($accessory, $validated) {
            $accessory->update([
                'item_id' => $validated['item_id'],
                'name' => $validated['name'],
                'item_kind' => $validated['item_kind'] ?? 'accessory',
                'slot' => $validated['slot'] ?? null,
                'accessory_type' => $validated['accessory_type'] ?? null,
                'equip_level' => $validated['equip_level'] ?? null,
                'description' => $validated['description'] ?? null,
                'effects_json' => $validated['effects_json'] ?? [],
                'synthesis_effects_json' => $validated['synthesis_effects_json'] ?? [],
                'obtain_methods_json' => $validated['obtain_methods_json'] ?? [],
                'image_url' => $validated['image_url'] ?? null,
                'source_url' => $validated['source_url'] ?? null,
                'detail_url' => $validated['detail_url'] ?? null,
            ]);

            $this->monsterDropSyncService->sync(
                'accessory',
                $accessory->id,
                $validated['drop_monsters'] ?? []
            );
        });

        return response()->json([
            'message' => 'アクセサリを更新した',
            'data' => $this->buildAccessoryResponse($accessory->fresh()),
        ]);
    }

    public function destroy(Accessory $accessory): JsonResponse
    {
        DB::transaction(function () use ($accessory) {
            MonsterDrop::query()
                ->where('drop_target_type', 'accessory')
                ->where('drop_target_id', $accessory->id)
                ->delete();

            $accessory->delete();
        });

        return response()->json([
            'message' => 'アクセサリを削除した',
        ]);
    }

    private function buildAccessoryResponse(Accessory $accessory): array
    {
        $drops = MonsterDrop::query()
            ->where('drop_target_type', 'accessory')
            ->where('drop_target_id', $accessory->id)
            ->orderByRaw('sort_order is null, sort_order asc')
            ->get();

        $monsterIds = $drops->pluck('monster_id')->filter()->values()->all();

        $monstersById = Monster::query()
            ->whereIn('id', $monsterIds)
            ->get()
            ->keyBy('id');

        return [
            'id' => $accessory->id,
            'item_id' => $accessory->item_id,
            'name' => $accessory->name,
            'item_kind' => $accessory->item_kind,
            'slot' => $accessory->slot,
            'accessory_type' => $accessory->accessory_type,
            'equip_level' => $accessory->equip_level,
            'description' => $accessory->description,
            'effects_json' => $this->normalizeJsonOutput($accessory->effects_json),
            'synthesis_effects_json' => $this->normalizeJsonOutput($accessory->synthesis_effects_json),
            'obtain_methods_json' => $this->normalizeJsonOutput($accessory->obtain_methods_json),
            'image_url' => $accessory->image_url,
            'source_url' => $accessory->source_url,
            'detail_url' => $accessory->detail_url,
            'drop_monsters' => $drops->map(function ($drop) use ($monstersById) {
                $monster = $monstersById->get($drop->monster_id);

                return [
                    'id' => $drop->id,
                    'monster_id' => $drop->monster_id,
                    'drop_type' => $drop->drop_type,
                    'sort_order' => $drop->sort_order,
                    'monster' => $monster ? [
                        'id' => $monster->id,
                        'monster_no' => $monster->monster_no,
                        'name' => $monster->name,
                        'system_type' => $monster->system_type,
                    ] : null,
                ];
            })->values(),
        ];
    }

    private function normalizeJsonOutput($value): array
    {
        if (is_array($value)) {
            return array_values($value);
        }

        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? array_values($decoded) : [];
        }

        return [];
    }
}