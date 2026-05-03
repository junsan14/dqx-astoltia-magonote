<?php

namespace App\Http\Controllers\Api;

use App\Models\Equipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EquipmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Equipment::query()
            ->with([
                'equipmentType.craftType:id,name',
                'equipmentType.equipableTypes.gameJob:id,name,key',
            ])
            ->whereNotNull('item_name');

        if ($request->filled('q')) {
            $q = trim((string) $request->q);
            $escaped = addcslashes($q, '\\%_');

            $query->where(function ($sub) use ($escaped) {
                $sub->where('item_name', 'like', "%{$escaped}%")
                    ->orWhere('item_name_en', 'like', "%{$escaped}%")
                    ->orWhere('item_id', 'like', "%{$escaped}%")
                    ->orWhere('group_name', 'like', "%{$escaped}%")
                    ->orWhere('recipe_book', 'like', "%{$escaped}%");
            })
            ->orderByRaw(
                "
                CASE
                    WHEN item_name = ? THEN 0
                    WHEN item_name_en = ? THEN 0
                    WHEN item_name LIKE ? THEN 1
                    WHEN item_name_en LIKE ? THEN 1
                    ELSE 2
                END
                ",
                [$q, $q, $escaped . '%', $escaped . '%']
            )
            ->orderByRaw('LENGTH(COALESCE(item_name_en, item_name)) ASC');
        }

        if ($request->filled('equipment_type_id')) {
            $query->where('equipment_type_id', $request->equipment_type_id);
        }

        if ($request->filled('craft_level')) {
            $query->where('craft_level', $request->craft_level);
        }

        if ($request->filled('equip_level')) {
            $query->where('equip_level', $request->equip_level);
        }

        if ($request->filled('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        if ($request->filled('group_kind')) {
            $query->where('group_kind', $request->group_kind);
        }

        if ($request->filled('slot')) {
            $query->where('slot', $request->slot);
        }

        if ($request->filled('craft_type')) {
            $craftType = trim((string) $request->craft_type);

            $query->whereHas('equipmentType.craftType', function ($sub) use ($craftType) {
                $sub->where('name', $craftType);
            });
        }

        $rows = $query
            ->orderBy('craft_level')
            ->orderBy('equip_level')
            ->orderBy('group_name')
            ->orderBy('item_name')
            ->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function show($id): JsonResponse
    {
        $equipment = Equipment::with([
            'equipmentType.equipableTypes.gameJob:id,name,key',
        ])->find($id);

        if (!$equipment) {
            return response()->json([
                'message' => 'equipment not found',
            ], 404);
        }

        return response()->json([
            'data' => $equipment,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePayload($request);

        if (empty($validated['item_id'])) {
            $validated['item_id'] = $this->makeItemId(
                $validated['item_name'],
                $validated['equipment_type_id'] ?? null
            );
        }

        if (empty($validated['group_id'])) {
            $validated['group_id'] = $validated['item_id'];
        }

        if (empty($validated['group_name'])) {
            $validated['group_name'] = $validated['item_name'];
        }

        $equipment = Equipment::create($validated)->load([
            'equipmentType.equipableTypes.gameJob:id,name,key',
        ]);

        return response()->json([
            'data' => $equipment,
        ], 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $equipment = Equipment::find($id);

        if (!$equipment) {
            return response()->json([
                'message' => 'equipment not found',
            ], 404);
        }

        $validated = $this->validatePayload($request);

        if (
            array_key_exists('item_id', $validated)
            && ($validated['item_id'] === null || $validated['item_id'] === '')
        ) {
            $validated['item_id'] = $this->makeItemId(
                $validated['item_name'] ?? $equipment->item_name,
                $validated['equipment_type_id'] ?? $equipment->equipment_type_id
            );
        }

        if (
            array_key_exists('group_id', $validated)
            && ($validated['group_id'] === null || $validated['group_id'] === '')
        ) {
            $validated['group_id'] = $validated['item_id'] ?? $equipment->item_id;
        }

        if (
            array_key_exists('group_name', $validated)
            && ($validated['group_name'] === null || $validated['group_name'] === '')
        ) {
            $validated['group_name'] = $validated['item_name'] ?? $equipment->item_name;
        }

        $equipment->update($validated);

        return response()->json([
            'data' => $equipment->load([
                'equipmentType.equipableTypes.gameJob:id,name,key',
            ]),
        ]);
    }

    public function destroy($id): JsonResponse
    {
        $equipment = Equipment::with([
            'equipmentType.equipableTypes.gameJob:id,name,key',
        ])->find($id);

        if (!$equipment) {
            return response()->json([
                'message' => 'equipment not found',
            ], 404);
        }

        $deleted = $equipment->toArray();
        $equipment->delete();

        return response()->json([
            'message' => 'deleted',
            'data' => $deleted,
        ]);
    }

    private function validatePayload(Request $request): array
    {
        $validated = $request->validate([
            'item_id' => ['nullable', 'string', 'max:255'],
            'item_name' => ['required', 'string', 'max:255'],
            'item_name_en' => ['nullable', 'string', 'max:255'],
            'equipment_type_id' => ['nullable', 'integer', 'exists:equipment_types,id'],
            'job_override_mode' => ['nullable', Rule::in(['inherit', 'add', 'replace'])],
            'override_jobs_json' => ['nullable', 'array'],
            'craft_level' => ['nullable', 'integer', 'min:0'],
            'equip_level' => ['nullable', 'integer', 'min:0'],
            'recipe_book' => ['nullable', 'string', 'max:255'],
            'recipe_place' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'slot' => ['nullable', 'string', 'max:255'],
            'slot_grid_type' => ['nullable', 'string', 'max:255'],
            'slot_grid_cols' => ['nullable', 'integer', 'min:0'],
            'group_kind' => ['nullable', 'string', 'max:255'],
            'group_id' => ['nullable', 'string', 'max:255'],
            'group_name' => ['nullable', 'string', 'max:255'],
            'materials_json' => ['nullable', 'array'],
            'slot_grid_json' => ['nullable', 'array'],
            'source_url' => ['nullable', 'string', 'max:255'],
            'detail_url' => ['nullable', 'string', 'max:255'],
            'effects_json' => ['nullable', 'array'],
        ]);

        if (
            !array_key_exists('job_override_mode', $validated)
            || !$validated['job_override_mode']
        ) {
            $validated['job_override_mode'] = 'inherit';
        }

        if (!array_key_exists('override_jobs_json', $validated)) {
            $validated['override_jobs_json'] = [];
        }

        return $validated;
    }

    private function makeItemId(string $itemName, $equipmentTypeId = null): string
    {
        $base = trim($itemName);

        if ($equipmentTypeId) {
            return $equipmentTypeId . '_' . $base;
        }

        return $base;
    }
}