<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class EquipmentController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = DB::table('equipments')
            ->select([
                'id',
                'item_id',
                'item_name',
                'item_kind',
                'item_type_key',
                'item_type',
                'craft_type',
                'craft_level',
                'equip_level',
                'recipe_book',
                'recipe_place',
                'description',
                'slot',
                'slot_grid_type',
                'slot_grid_cols',
                'group_kind',
                'group_id',
                'group_name',
                'items_count',
                'crystal_by_alchemy',
                'materials_json',
                'slot_grid_json',
                'jobs_json',
                'equipable_type',
                'source_url',
                'detail_url',
                'effects_json',
                'created_at',
                'updated_at',
            ])
            ->whereNotNull('item_name')
            ->where(function ($q) {
                $q->whereNotNull('craft_type')
                  ->orWhereNotNull('materials_json');
            })
            ->orderByRaw("
                CASE craft_type
                    WHEN '裁縫' THEN 1
                    WHEN '武器鍛冶' THEN 2
                    WHEN '防具鍛冶' THEN 3
                    WHEN '木工' THEN 4
                    ELSE 99
                END
            ")
            ->orderBy('equip_level')
            ->orderBy('group_name')
            ->orderBy('item_name')
            ->get();

        $itemMap = $this->buildItemMapFromEquipments($rows);

        $data = $rows->map(function ($row) use ($itemMap) {
            $row->materials_json = $this->normalizeMaterialsJson(
                $row->materials_json,
                $itemMap
            );

            $row->slot_grid_json = $this->normalizeJsonValue($row->slot_grid_json, null);
            $row->jobs_json = $this->normalizeJsonValue($row->jobs_json, []);
            $row->effects_json = $this->normalizeJsonValue($row->effects_json, []);

            return $row;
        });

        return response()->json([
            'data' => $data,
        ]);
    }

    private function buildItemMapFromEquipments(Collection $rows): array
    {
        $itemIds = [];

        foreach ($rows as $row) {
            $materials = $this->decodeJsonArray($row->materials_json);

            foreach ($materials as $material) {
                if (!is_array($material)) {
                    continue;
                }

                $itemId = $this->extractMaterialItemId($material);

                if ($itemId !== null && $itemId !== '') {
                    $itemIds[] = (string) $itemId;
                }
            }
        }

        $itemIds = array_values(array_unique($itemIds));

        if (empty($itemIds)) {
            return [];
        }

        return DB::table('items')
            ->whereIn('id', $itemIds)
            ->get(['id', 'name', 'buy_price'])
            ->keyBy(fn ($item) => (string) $item->id)
            ->map(fn ($item) => [
                'id' => (int) $item->id,
                'name' => $item->name,
                'buy_price' => (int) ($item->buy_price ?? 0),
            ])
            ->toArray();
    }

    private function normalizeMaterialsJson($materialsJson, array $itemMap): string
    {
        $materials = $this->decodeJsonArray($materialsJson);

        $normalized = [];

        foreach ($materials as $material) {
            if (is_string($material)) {
                $normalized[] = [
                    'item_id' => null,
                    'name' => $material,
                    'qty' => 1,
                    'defaultUnitCost' => 0,
                ];
                continue;
            }

            if (!is_array($material)) {
                continue;
            }

            $itemId = $this->extractMaterialItemId($material);
            $master = $itemId ? ($itemMap[(string) $itemId] ?? null) : null;

            $name =
                $material['name']
                ?? $material['material_name']
                ?? $material['item_name']
                ?? $material['label']
                ?? ($master['name'] ?? null);

            $qty =
                $material['qty']
                ?? $material['quantity']
                ?? $material['count']
                ?? $material['num']
                ?? 0;

            $defaultUnitCost =
                $material['defaultUnitCost']
                ?? $material['default_unit_cost']
                ?? $material['unitCost']
                ?? $material['unit_cost']
                ?? $material['price']
                ?? ($master['buy_price'] ?? 0);

            $normalized[] = [
                'item_id' => $itemId ? (int) $itemId : null,
                'name' => $name ?: '不明な素材',
                'qty' => (int) $qty,
                'defaultUnitCost' => (int) $defaultUnitCost,
            ];
        }

        return json_encode($normalized, JSON_UNESCAPED_UNICODE);
    }

    private function extractMaterialItemId(array $material): ?string
    {
        $itemId =
            $material['item_id']
            ?? $material['itemId']
            ?? $material['id']
            ?? null;

        if ($itemId === null || $itemId === '') {
            return null;
        }

        return (string) $itemId;
    }

    private function decodeJsonArray($value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if ($value === null || $value === '') {
            return [];
        }

        try {
            $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
            return is_array($decoded) ? $decoded : [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function normalizeJsonValue($value, $fallback)
    {
        if (is_array($value)) {
            return $value;
        }

        if ($value === null || $value === '') {
            return $fallback;
        }

        try {
            return json_decode($value, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable $e) {
            return $fallback;
        }
    }

public function store(Request $request)
{
    //dd($request);
    $validated = $request->validate([
        'item_id' => ['nullable', 'string', 'max:255'],
        'item_name' => ['required', 'string', 'max:255'],
        'item_kind' => ['nullable', 'string', 'max:255'],
        'item_type_key' => ['nullable', 'string', 'max:255'],
        'item_type' => ['nullable', 'string', 'max:255'],
        'craft_type' => ['nullable', 'string', 'max:255'],
        'craft_level' => ['nullable', 'integer'],
        'equip_level' => ['nullable', 'integer'],
        'recipe_book' => ['nullable', 'string', 'max:255'],
        'recipe_place' => ['nullable', 'string', 'max:255'],
        'slot' => ['nullable', 'string', 'max:255'],
        'slot_grid_type' => ['nullable', 'string', 'max:255'],
        'slot_grid_cols' => ['nullable', 'integer'],
        'group_kind' => ['nullable', 'string', 'max:255'],
        'group_id' => ['nullable', 'string', 'max:255'],
        'group_name' => ['nullable', 'string', 'max:255'],
        'items_count' => ['nullable', 'integer'],
        'crystal_by_alchemy' => ['nullable', 'string', 'max:255'],
        'materials_json' => ['nullable', 'array'],
        'slot_grid_json' => ['nullable'],
        'jobs_json' => ['nullable', 'array'],
        'equipable_type' => ['nullable', 'string', 'max:255'],
    ]);

    $itemId = $validated['item_id'] ?? null;

    if (!$itemId) {
        $craftType = trim((string)($validated['craft_type'] ?? ''));
        $itemName = trim((string)($validated['item_name'] ?? ''));

        $itemId = $craftType !== ''
            ? $craftType . '_' . $itemName
            : $itemName;
    }

    $groupId = $validated['group_id'] ?? null;
    if (!$groupId) {
        $groupId = $itemId;
    }

    $slotGridJson = $validated['slot_grid_json'] ?? null;

    // 文字列で来た場合はJSONとして解釈を試みる
    if (is_string($slotGridJson) && $slotGridJson !== '') {
        $decoded = json_decode($slotGridJson, true);
        $slotGridJson = json_last_error() === JSON_ERROR_NONE ? $decoded : $slotGridJson;
    }

    $id = DB::table('equipments')->insertGetId([
        'item_id' => $itemId,
        'item_name' => $validated['item_name'],
        'item_kind' => $validated['item_kind'] ?? null,
        'item_type_key' => $validated['item_type_key'] ?? null,
        'item_type' => $validated['item_type'] ?? null,
        'craft_type' => $validated['craft_type'] ?? null,
        'craft_level' => $validated['craft_level'] ?? null,
        'equip_level' => $validated['equip_level'] ?? null,
        'recipe_book' => $validated['recipe_book'] ?? null,
        'recipe_place' => $validated['recipe_place'] ?? null,
        'slot' => $validated['slot'] ?? null,
        'slot_grid_type' => $validated['slot_grid_type'] ?? null,
        'slot_grid_cols' => $validated['slot_grid_cols'] ?? null,
        'group_kind' => $validated['group_kind'] ?? null,
        'group_id' => $groupId,
        'group_name' => $validated['group_name'] ?? $validated['item_name'],
        'items_count' => $validated['items_count'] ?? 1,
        'crystal_by_alchemy' => $validated['crystal_by_alchemy'] ?? null,
        'materials_json' => json_encode($validated['materials_json'] ?? [], JSON_UNESCAPED_UNICODE),
        'slot_grid_json' => $slotGridJson !== null
            ? json_encode($slotGridJson, JSON_UNESCAPED_UNICODE)
            : null,
        'jobs_json' => json_encode($validated['jobs_json'] ?? [], JSON_UNESCAPED_UNICODE),
        'equipable_type' => $validated['equipable_type'] ?? null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return $this->showOne($id);
}

    public function update(Request $request, $id)
{
    $validated = $request->validate([
        'item_id' => ['nullable', 'string', 'max:255'],
        'item_name' => ['required', 'string', 'max:255'],
        'item_kind' => ['nullable', 'string', 'max:255'],
        'item_type_key' => ['nullable', 'string', 'max:255'],
        'item_type' => ['nullable', 'string', 'max:255'],
        'craft_type' => ['nullable', 'string', 'max:255'],
        'craft_level' => ['nullable', 'integer'],
        'equip_level' => ['nullable', 'integer'],
        'recipe_book' => ['nullable', 'string', 'max:255'],
        'recipe_place' => ['nullable', 'string', 'max:255'],
        'slot' => ['nullable', 'string', 'max:255'],
        'slot_grid_type' => ['nullable', 'string', 'max:255'],
        'slot_grid_cols' => ['nullable', 'integer'],
        'group_kind' => ['nullable', 'string', 'max:255'],
        'group_id' => ['nullable', 'string', 'max:255'],
        'group_name' => ['nullable', 'string', 'max:255'],
        'items_count' => ['nullable', 'integer'],
        'crystal_by_alchemy' => ['nullable', 'string', 'max:255'],
        'materials_json' => ['nullable', 'array'],
        'slot_grid_json' => ['nullable'],
        'jobs_json' => ['nullable', 'array'],
        'equipable_type' => ['nullable', 'string', 'max:255'],
    ]);

    $exists = DB::table('equipments')->where('id', $id)->exists();

    if (!$exists) {
        return response()->json([
            'message' => 'equipment not found',
        ], 404);
    }

    DB::table('equipments')
        ->where('id', $id)
        ->update([
            'item_id' => $validated['item_id'] ?? null,
            'item_name' => $validated['item_name'],
            'item_kind' => $validated['item_kind'] ?? null,
            'item_type_key' => $validated['item_type_key'] ?? null,
            'item_type' => $validated['item_type'] ?? null,
            'craft_type' => $validated['craft_type'] ?? null,
            'craft_level' => $validated['craft_level'] ?? null,
            'equip_level' => $validated['equip_level'] ?? null,
            'recipe_book' => $validated['recipe_book'] ?? null,
            'recipe_place' => $validated['recipe_place'] ?? null,
            'slot' => $validated['slot'] ?? null,
            'slot_grid_type' => $validated['slot_grid_type'] ?? null,
            'slot_grid_cols' => $validated['slot_grid_cols'] ?? null,
            'group_kind' => $validated['group_kind'] ?? null,
            'group_id' => $validated['group_id'] ?? null,
            'group_name' => $validated['group_name'] ?? null,
            'items_count' => $validated['items_count'] ?? 1,
            'crystal_by_alchemy' => $validated['crystal_by_alchemy'] ?? null,
            'materials_json' => json_encode($validated['materials_json'] ?? [], JSON_UNESCAPED_UNICODE),
            'slot_grid_json' => array_key_exists('slot_grid_json', $validated)
                ? json_encode($validated['slot_grid_json'], JSON_UNESCAPED_UNICODE)
                : null,
            'jobs_json' => json_encode($validated['jobs_json'] ?? [], JSON_UNESCAPED_UNICODE),
            'equipable_type' => $validated['equipable_type'] ?? null,
            'updated_at' => now(),
        ]);

    $equipment = DB::table('equipments')->where('id', $id)->first();

    return response()->json([
        'data' => $equipment,
    ]);
}

    public function destroy($id)
{
    $equipment = DB::table('equipments')->where('id', $id)->first();

    if (!$equipment) {
        return response()->json([
            'message' => 'equipment not found',
        ], 404);
    }

    DB::table('equipments')->where('id', $id)->delete();

    return response()->json([
        'message' => 'deleted',
        'data' => $equipment,
    ]);
}

    protected function showOne($id)
    {
        $row = DB::table('equipments')->where('id', $id)->first();

        if (!$row) {
            abort(404);
        }

        $itemMap = DB::table('items')
            ->select('id', 'name', 'buy_price')
            ->get()
            ->keyBy('id');

        $materials = $this->decodeJson($row->materials_json, []);

        $normalizedMaterials = collect($materials)->map(function ($m) use ($itemMap) {
            if (is_string($m)) {
                return [
                    'item_id' => null,
                    'name' => $m,
                    'qty' => 1,
                    'defaultUnitCost' => 0,
                ];
            }

            $itemId = $m['item_id'] ?? $m['id'] ?? null;
            $count = $m['count'] ?? $m['qty'] ?? $m['quantity'] ?? 1;

            $item = $itemId ? ($itemMap[$itemId] ?? null) : null;

            return [
                'item_id' => $itemId,
                'name' => $m['name']
                    ?? $m['item_name']
                    ?? optional($item)->name
                    ?? '不明な素材',
                'qty' => (int) $count,
                'defaultUnitCost' => (int) (
                    $m['defaultUnitCost']
                    ?? $m['default_unit_cost']
                    ?? $m['unitCost']
                    ?? $m['unit_cost']
                    ?? optional($item)->buy_price
                    ?? 0
                ),
            ];
        })->values()->all();

        return response()->json([
            'data' => [
                'id' => $row->id,
                'item_id' => $row->item_id,
                'item_name' => $row->item_name,
                'item_kind' => $row->item_kind,
                'item_type_key' => $row->item_type_key,
                'item_type' => $row->item_type,
                'craft_type' => $row->craft_type,
                'craft_level' => $row->craft_level,
                'equip_level' => $row->equip_level,
                'recipe_book' => $row->recipe_book,
                'recipe_place' => $row->recipe_place,
                'slot' => $row->slot,
                'slot_grid_type' => $row->slot_grid_type,
                'slot_grid_cols' => $row->slot_grid_cols,
                'group_kind' => $row->group_kind,
                'group_id' => $row->group_id,
                'group_name' => $row->group_name,
                'items_count' => $row->items_count,
                'crystal_by_alchemy' => $row->crystal_by_alchemy,
                'materials_json' => $normalizedMaterials,
                'slot_grid_json' => $this->decodeJson($row->slot_grid_json, null),
                'jobs_json' => $this->decodeJson($row->jobs_json, []),
                'equipable_type' => $row->equipable_type,
            ],
        ]);
    }

    protected function decodeJson($value, $fallback)
    {
        if ($value === null || $value === '') {
            return $fallback;
        }

        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode($value, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $fallback;
    }
}